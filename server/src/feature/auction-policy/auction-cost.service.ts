import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAuctionCostDto } from './dto/create-auction-cost.dto';
import { UpdateAuctionCostDto } from './dto/update-auction-cost.dto';
import { PolicyCalculationService } from './policy-calculation.service';

/**
 * Auction Cost Service
 * Manages variable auction costs (Module 4)
 * Tracks expenses like advertising, venue rental, appraisal, etc.
 */
@Injectable()
export class AuctionCostService {
  private readonly logger = new Logger(AuctionCostService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policyCalc: PolicyCalculationService
  ) {}

  /**
   * Create or update auction costs for an auction
   */
  async upsert(auctionId: string, dto: CreateAuctionCostDto) {
    try {
      // Verify auction exists
      const auction = await this.prisma.auction.findUnique({
        where: { id: auctionId },
      });

      if (!auction) {
        throw new NotFoundException(`Auction with ID ${auctionId} not found`);
      }

      // Calculate total costs
      const totalCosts = this.policyCalc.calculateTotalCosts({
        advertisingCost: dto.advertisingCost,
        venueRentalCost: dto.venueRentalCost,
        appraisalCost: dto.appraisalCost,
        assetViewingCost: dto.assetViewingCost,
        otherCosts: dto.otherCosts,
      });

      // Prepare other costs JSON
      const otherCostsJson =
        dto.otherCosts && dto.otherCosts.length > 0
          ? JSON.stringify(dto.otherCosts)
          : null;

      // Upsert auction costs
      const costs = await this.prisma.auctionCost.upsert({
        where: { auctionId },
        create: {
          auctionId,
          advertisingCost: dto.advertisingCost ?? 0,
          venueRentalCost: dto.venueRentalCost ?? 0,
          appraisalCost: dto.appraisalCost ?? 0,
          assetViewingCost: dto.assetViewingCost ?? 0,
          otherCosts: otherCostsJson,
          totalCosts,
        },
        update: {
          advertisingCost: dto.advertisingCost ?? 0,
          venueRentalCost: dto.venueRentalCost ?? 0,
          appraisalCost: dto.appraisalCost ?? 0,
          assetViewingCost: dto.assetViewingCost ?? 0,
          otherCosts: otherCostsJson,
          totalCosts,
        },
      });

      this.logger.log(
        `Auction costs updated for auction ${auctionId}. Total: ${totalCosts}`
      );

      return this.formatCostResponse(costs);
    } catch (error) {
      this.logger.error(
        `Failed to upsert auction costs for ${auctionId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get auction costs by auction ID
   */
  async findByAuction(auctionId: string) {
    const costs = await this.prisma.auctionCost.findUnique({
      where: { auctionId },
      include: {
        auction: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    if (!costs) {
      throw new NotFoundException(`No costs found for auction ${auctionId}`);
    }

    return this.formatCostResponse(costs);
  }

  /**
   * Update specific cost fields
   */
  async update(auctionId: string, dto: UpdateAuctionCostDto) {
    try {
      // Get existing costs
      const existing = await this.prisma.auctionCost.findUnique({
        where: { auctionId },
      });

      if (!existing) {
        throw new NotFoundException(`No costs found for auction ${auctionId}`);
      }

      // Merge updates with existing values
      const updatedData = {
        advertisingCost:
          dto.advertisingCost ??
          parseFloat(existing.advertisingCost.toString()),
        venueRentalCost:
          dto.venueRentalCost ??
          parseFloat(existing.venueRentalCost.toString()),
        appraisalCost:
          dto.appraisalCost ?? parseFloat(existing.appraisalCost.toString()),
        assetViewingCost:
          dto.assetViewingCost ??
          parseFloat(existing.assetViewingCost.toString()),
        otherCosts:
          dto.otherCosts ??
          (existing.otherCosts
            ? JSON.parse(existing.otherCosts as string)
            : []),
      };

      // Recalculate total
      const totalCosts = this.policyCalc.calculateTotalCosts(updatedData);

      const updated = await this.prisma.auctionCost.update({
        where: { auctionId },
        data: {
          advertisingCost: updatedData.advertisingCost,
          venueRentalCost: updatedData.venueRentalCost,
          appraisalCost: updatedData.appraisalCost,
          assetViewingCost: updatedData.assetViewingCost,
          otherCosts:
            updatedData.otherCosts.length > 0
              ? JSON.stringify(updatedData.otherCosts)
              : null,
          totalCosts,
        },
      });

      this.logger.log(
        `Updated auction costs for ${auctionId}. New total: ${totalCosts}`
      );

      return this.formatCostResponse(updated);
    } catch (error) {
      this.logger.error(
        `Failed to update auction costs for ${auctionId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Delete auction costs
   */
  async remove(auctionId: string) {
    try {
      const existing = await this.prisma.auctionCost.findUnique({
        where: { auctionId },
      });

      if (!existing) {
        throw new NotFoundException(`No costs found for auction ${auctionId}`);
      }

      await this.prisma.auctionCost.delete({
        where: { auctionId },
      });

      this.logger.log(`Deleted auction costs for ${auctionId}`);

      return { message: 'Auction costs deleted successfully', auctionId };
    } catch (error) {
      this.logger.error(
        `Failed to delete auction costs for ${auctionId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Add an individual cost item to "other costs"
   */
  async addOtherCost(auctionId: string, description: string, amount: number) {
    try {
      const existing = await this.prisma.auctionCost.findUnique({
        where: { auctionId },
      });

      if (!existing) {
        throw new NotFoundException(`No costs found for auction ${auctionId}`);
      }

      // Parse existing other costs
      const otherCosts = existing.otherCosts
        ? JSON.parse(existing.otherCosts as string)
        : [];

      // Add new cost
      otherCosts.push({ description, amount });

      // Recalculate total
      const totalCosts = this.policyCalc.calculateTotalCosts({
        advertisingCost: parseFloat(existing.advertisingCost.toString()),
        venueRentalCost: parseFloat(existing.venueRentalCost.toString()),
        appraisalCost: parseFloat(existing.appraisalCost.toString()),
        assetViewingCost: parseFloat(existing.assetViewingCost.toString()),
        otherCosts,
      });

      const updated = await this.prisma.auctionCost.update({
        where: { auctionId },
        data: {
          otherCosts: JSON.stringify(otherCosts),
          totalCosts,
        },
      });

      this.logger.log(
        `Added other cost to auction ${auctionId}: ${description} - ${amount}`
      );

      return this.formatCostResponse(updated);
    } catch (error) {
      this.logger.error(`Failed to add other cost to ${auctionId}`, error);
      throw error;
    }
  }

  /**
   * Format cost response with parsed JSON
   */
  private formatCostResponse(costs: any) {
    return {
      id: costs.id,
      auctionId: costs.auctionId,
      advertisingCost: parseFloat(costs.advertisingCost.toString()),
      venueRentalCost: parseFloat(costs.venueRentalCost.toString()),
      appraisalCost: parseFloat(costs.appraisalCost.toString()),
      assetViewingCost: parseFloat(costs.assetViewingCost.toString()),
      otherCosts: costs.otherCosts
        ? JSON.parse(costs.otherCosts as string)
        : [],
      totalCosts: parseFloat(costs.totalCosts.toString()),
      createdAt: costs.createdAt,
      updatedAt: costs.updatedAt,
      auction: costs.auction,
    };
  }
}
