import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAuctionPolicyDto, AssetOwnershipDto } from './dto/create-auction-policy.dto';
import { UpdateAuctionPolicyDto } from './dto/update-auction-policy.dto';
import { PolicyCalculationService } from './policy-calculation.service';

/**
 * Auction Policy Service
 * Manages CRUD operations for auction policies and their configurations
 */
@Injectable()
export class AuctionPolicyService {
  private readonly logger = new Logger(AuctionPolicyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policyCalc: PolicyCalculationService,
  ) {}

  /**
   * Create a new auction policy with configurations
   */
  async create(dto: CreateAuctionPolicyDto) {
    try {
      // If this policy is marked as default, unset existing defaults
      if (dto.isDefault) {
        await this.prisma.auctionPolicy.updateMany({
          where: {
            assetOwnership: dto.assetOwnership,
            isDefault: true,
          },
          data: {
            isDefault: false,
          },
        });
      }

      // Generate unique ID
      const policyId = `policy_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Create policy with nested configurations
      const policy = await this.prisma.auctionPolicy.create({
        data: {
          id: policyId,
          name: dto.name,
          description: dto.description,
          assetOwnership: dto.assetOwnership,
          isActive: dto.isActive ?? true,
          isDefault: dto.isDefault ?? false,

          // Commission configuration
          ...(dto.commissionConfig && {
            commissionConfig: {
              create: {
                id: `commission_${policyId}`,
                assetCategory: dto.commissionConfig.assetCategory,
                tiers: JSON.stringify(dto.commissionConfig.tiers),
                minCommission: dto.commissionConfig.minCommission ?? 1_000_000,
                maxCommission: dto.commissionConfig.maxCommission ?? 400_000_000,
              },
            },
          }),

          // Dossier fee configuration
          ...(dto.dossierConfig && {
            dossierConfig: {
              create: {
                id: `dossier_${policyId}`,
                feeTiers: JSON.stringify(dto.dossierConfig.feeTiers),
              },
            },
          }),

          // Deposit configuration
          ...(dto.depositConfig && {
            depositConfig: {
              create: {
                id: `deposit_${policyId}`,
                depositType: dto.depositConfig.depositType,
                assetCategory: dto.depositConfig.assetCategory,
                minPercentage: dto.depositConfig.minPercentage,
                maxPercentage: dto.depositConfig.maxPercentage,
                fixedAmount: dto.depositConfig.fixedAmount,
                minDepositAmount: dto.depositConfig.minDepositAmount,
                maxDepositAmount: dto.depositConfig.maxDepositAmount,
                depositDeadlineHours: dto.depositConfig.depositDeadlineHours ?? 24,
                requiresDocuments: dto.depositConfig.requiresDocuments ?? true,
                requiredDocumentTypes: dto.depositConfig.requiredDocumentTypes
                  ? JSON.stringify(dto.depositConfig.requiredDocumentTypes)
                  : null,
                refundDeadlineDays: dto.depositConfig.refundDeadlineDays ?? 3,
              },
            },
          }),
        },
        include: {
          commissionConfig: true,
          dossierConfig: true,
          depositConfig: true,
        },
      });

      this.logger.log(`Created auction policy: ${policy.id}`);
      return this.formatPolicyResponse(policy);
    } catch (error) {
      this.logger.error('Failed to create auction policy', error);
      throw error;
    }
  }

  /**
   * Get all auction policies with optional filters
   */
  async findAll(filters?: {
    assetOwnership?: AssetOwnershipDto;
    isActive?: boolean;
    isDefault?: boolean;
  }) {
    const policies = await this.prisma.auctionPolicy.findMany({
      where: {
        ...(filters?.assetOwnership && { assetOwnership: filters.assetOwnership }),
        ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
        ...(filters?.isDefault !== undefined && { isDefault: filters.isDefault }),
      },
      include: {
        commissionConfig: true,
        dossierConfig: true,
        depositConfig: true,
        _count: {
          select: { auctions: true },
        },
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return policies.map(policy => this.formatPolicyResponse(policy));
  }

  /**
   * Get a single policy by ID
   */
  async findOne(id: string) {
    const policy = await this.prisma.auctionPolicy.findUnique({
      where: { id },
      include: {
        commissionConfig: true,
        dossierConfig: true,
        depositConfig: true,
        _count: {
          select: { auctions: true },
        },
      },
    });

    if (!policy) {
      throw new NotFoundException(`Auction policy with ID ${id} not found`);
    }

    return this.formatPolicyResponse(policy);
  }

  /**
   * Get the default policy for a given asset ownership type
   */
  async findDefault(assetOwnership: AssetOwnershipDto) {
    const policy = await this.prisma.auctionPolicy.findFirst({
      where: {
        assetOwnership,
        isDefault: true,
        isActive: true,
      },
      include: {
        commissionConfig: true,
        dossierConfig: true,
        depositConfig: true,
      },
    });

    if (!policy) {
      throw new NotFoundException(`No default policy found for ${assetOwnership} assets`);
    }

    return this.formatPolicyResponse(policy);
  }

  /**
   * Update an existing auction policy
   */
  async update(id: string, dto: UpdateAuctionPolicyDto) {
    try {
      // Check if policy exists
      const existing = await this.prisma.auctionPolicy.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new NotFoundException(`Auction policy with ID ${id} not found`);
      }

      // If setting as default, unset other defaults
      if (dto.isDefault) {
        await this.prisma.auctionPolicy.updateMany({
          where: {
            assetOwnership: existing.assetOwnership,
            isDefault: true,
            id: { not: id },
          },
          data: {
            isDefault: false,
          },
        });
      }

      // Update policy and configurations
      const updated = await this.prisma.auctionPolicy.update({
        where: { id },
        data: {
          ...(dto.name && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),

          // Update commission config if provided
          ...(dto.commissionConfig && {
            commissionConfig: {
              upsert: {
                create: {
                  id: `commission_${id}`,
                  assetCategory: dto.commissionConfig.assetCategory,
                  tiers: JSON.stringify(dto.commissionConfig.tiers),
                  minCommission: dto.commissionConfig.minCommission ?? 1_000_000,
                  maxCommission: dto.commissionConfig.maxCommission ?? 400_000_000,
                },
                update: {
                  assetCategory: dto.commissionConfig.assetCategory,
                  tiers: JSON.stringify(dto.commissionConfig.tiers),
                  minCommission: dto.commissionConfig.minCommission,
                  maxCommission: dto.commissionConfig.maxCommission,
                },
              },
            },
          }),

          // Update dossier config if provided
          ...(dto.dossierConfig && {
            dossierConfig: {
              upsert: {
                create: {
                  id: `dossier_${id}`,
                  feeTiers: JSON.stringify(dto.dossierConfig.feeTiers),
                },
                update: {
                  feeTiers: JSON.stringify(dto.dossierConfig.feeTiers),
                },
              },
            },
          }),

          // Update deposit config if provided
          ...(dto.depositConfig && {
            depositConfig: {
              upsert: {
                create: {
                  id: `deposit_${id}`,
                  depositType: dto.depositConfig.depositType,
                  assetCategory: dto.depositConfig.assetCategory,
                  minPercentage: dto.depositConfig.minPercentage,
                  maxPercentage: dto.depositConfig.maxPercentage,
                  fixedAmount: dto.depositConfig.fixedAmount,
                  minDepositAmount: dto.depositConfig.minDepositAmount,
                  maxDepositAmount: dto.depositConfig.maxDepositAmount,
                  depositDeadlineHours: dto.depositConfig.depositDeadlineHours ?? 24,
                  requiresDocuments: dto.depositConfig.requiresDocuments ?? true,
                  requiredDocumentTypes: dto.depositConfig.requiredDocumentTypes
                    ? JSON.stringify(dto.depositConfig.requiredDocumentTypes)
                    : null,
                  refundDeadlineDays: dto.depositConfig.refundDeadlineDays ?? 3,
                },
                update: {
                  depositType: dto.depositConfig.depositType,
                  assetCategory: dto.depositConfig.assetCategory,
                  minPercentage: dto.depositConfig.minPercentage,
                  maxPercentage: dto.depositConfig.maxPercentage,
                  fixedAmount: dto.depositConfig.fixedAmount,
                  minDepositAmount: dto.depositConfig.minDepositAmount,
                  maxDepositAmount: dto.depositConfig.maxDepositAmount,
                  depositDeadlineHours: dto.depositConfig.depositDeadlineHours,
                  requiresDocuments: dto.depositConfig.requiresDocuments,
                  requiredDocumentTypes: dto.depositConfig.requiredDocumentTypes
                    ? JSON.stringify(dto.depositConfig.requiredDocumentTypes)
                    : undefined,
                  refundDeadlineDays: dto.depositConfig.refundDeadlineDays,
                },
              },
            },
          }),
        },
        include: {
          commissionConfig: true,
          dossierConfig: true,
          depositConfig: true,
        },
      });

      this.logger.log(`Updated auction policy: ${id}`);
      return this.formatPolicyResponse(updated);
    } catch (error) {
      this.logger.error(`Failed to update auction policy ${id}`, error);
      throw error;
    }
  }

  /**
   * Delete an auction policy
   * Only allowed if no auctions are using it
   */
  async remove(id: string) {
    try {
      const policy = await this.prisma.auctionPolicy.findUnique({
        where: { id },
        include: {
          _count: {
            select: { auctions: true },
          },
        },
      });

      if (!policy) {
        throw new NotFoundException(`Auction policy with ID ${id} not found`);
      }

      if (policy._count.auctions > 0) {
        throw new ConflictException(
          `Cannot delete policy ${id}. It is being used by ${policy._count.auctions} auction(s)`,
        );
      }

      // Delete configurations first
      await this.prisma.commissionPolicyConfig.deleteMany({ where: { policyId: id } });
      await this.prisma.dossierFeePolicyConfig.deleteMany({ where: { policyId: id } });
      await this.prisma.depositPolicyConfig.deleteMany({ where: { policyId: id } });

      // Delete policy
      await this.prisma.auctionPolicy.delete({ where: { id } });

      this.logger.log(`Deleted auction policy: ${id}`);
      return { message: 'Policy deleted successfully', id };
    } catch (error) {
      this.logger.error(`Failed to delete auction policy ${id}`, error);
      throw error;
    }
  }

  /**
   * Format policy response with parsed JSON fields
   */
  private formatPolicyResponse(policy: any) {
    return {
      id: policy.id,
      name: policy.name,
      description: policy.description,
      assetOwnership: policy.assetOwnership,
      isActive: policy.isActive,
      isDefault: policy.isDefault,
      createdAt: policy.createdAt,
      updatedAt: policy.updatedAt,
      usageCount: policy._count?.auctions,

      commissionConfig: policy.commissionConfig
        ? {
            id: policy.commissionConfig.id,
            assetCategory: policy.commissionConfig.assetCategory,
            tiers: JSON.parse(policy.commissionConfig.tiers as string),
            minCommission: parseFloat(policy.commissionConfig.minCommission.toString()),
            maxCommission: parseFloat(policy.commissionConfig.maxCommission.toString()),
          }
        : null,

      dossierConfig: policy.dossierConfig
        ? {
            id: policy.dossierConfig.id,
            feeTiers: JSON.parse(policy.dossierConfig.feeTiers as string),
          }
        : null,

      depositConfig: policy.depositConfig
        ? {
            id: policy.depositConfig.id,
            depositType: policy.depositConfig.depositType,
            assetCategory: policy.depositConfig.assetCategory,
            minPercentage: policy.depositConfig.minPercentage
              ? parseFloat(policy.depositConfig.minPercentage.toString())
              : undefined,
            maxPercentage: policy.depositConfig.maxPercentage
              ? parseFloat(policy.depositConfig.maxPercentage.toString())
              : undefined,
            fixedAmount: policy.depositConfig.fixedAmount
              ? parseFloat(policy.depositConfig.fixedAmount.toString())
              : undefined,
            minDepositAmount: policy.depositConfig.minDepositAmount
              ? parseFloat(policy.depositConfig.minDepositAmount.toString())
              : undefined,
            maxDepositAmount: policy.depositConfig.maxDepositAmount
              ? parseFloat(policy.depositConfig.maxDepositAmount.toString())
              : undefined,
            depositDeadlineHours: policy.depositConfig.depositDeadlineHours,
            requiresDocuments: policy.depositConfig.requiresDocuments,
            requiredDocumentTypes: policy.depositConfig.requiredDocumentTypes
              ? JSON.parse(policy.depositConfig.requiredDocumentTypes as string)
              : null,
            refundDeadlineDays: policy.depositConfig.refundDeadlineDays,
          }
        : null,
    };
  }
}
