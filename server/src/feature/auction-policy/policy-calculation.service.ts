import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Policy Calculation Service
 * Implements all business logic from Vietnamese legal circulars:
 * - Circular 45/2017: Commission/Remuneration
 * - Circular 108/2020: Updates to commission
 * - Circular 48/2017: Dossier fees and deposits
 */
@Injectable()
export class PolicyCalculationService {
  private readonly logger = new Logger(PolicyCalculationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * MODULE 1: Calculate Commission/Remuneration Fee
   * Based on final sale price with progressive (tiered) calculation
   *
   * @param finalPrice - The hammer price (final sale price)
   * @param assetCategory - "general" or "land_use_right"
   * @returns Commission fee in VND
   */
  calculateCommission(finalPrice: number, assetCategory: 'general' | 'land_use_right' = 'general'): number {
    let commission = 0;

    if (assetCategory === 'general') {
      // Table 1.1: General Assets
      if (finalPrice <= 50_000_000) {
        commission = finalPrice * 0.05;
      } else if (finalPrice <= 100_000_000) {
        commission = 2_500_000 + (finalPrice - 50_000_000) * 0.035;
      } else if (finalPrice <= 500_000_000) {
        commission = 4_250_000 + (finalPrice - 100_000_000) * 0.03;
      } else if (finalPrice <= 1_000_000_000) {
        commission = 16_250_000 + (finalPrice - 500_000_000) * 0.02;
      } else if (finalPrice <= 5_000_000_000) {
        commission = 26_250_000 + (finalPrice - 1_000_000_000) * 0.015;
      } else if (finalPrice <= 10_000_000_000) {
        commission = 86_250_000 + (finalPrice - 5_000_000_000) * 0.002;
      } else {
        commission = 96_250_000 + (finalPrice - 10_000_000_000) * 0.001;
      }
    } else {
      // Table 1.2: Land Use Rights
      if (finalPrice <= 5_000_000_000) {
        // Note: Circular specifies a base value - using 0 as default
        const baseValue = 0;
        commission = 50_000_000 + (finalPrice - baseValue) * 0.0045;
      } else if (finalPrice <= 10_000_000_000) {
        commission = 72_500_000 + (finalPrice - 5_000_000_000) * 0.0015;
      } else {
        commission = 80_000_000 + (finalPrice - 10_000_000_000) * 0.001;
      }
    }

    // Apply min and max constraints
    const MIN_COMMISSION = 1_000_000;
    const MAX_COMMISSION = 400_000_000;

    commission = Math.max(commission, MIN_COMMISSION);
    commission = Math.min(commission, MAX_COMMISSION);

    return Math.round(commission);
  }

  /**
   * MODULE 2: Validate Dossier Fee
   * Fee must comply with maximum limits based on starting price
   *
   * @param dossierFee - The proposed dossier fee
   * @param startingPrice - The auction starting price
   * @returns Validation result with error message if invalid
   */
  validateDossierFee(dossierFee: number, startingPrice: number): { valid: boolean; message?: string; maxAllowed?: number } {
    let maxFee: number;

    // Table 2: Maximum Dossier Fee (Circular 48/2017)
    if (startingPrice <= 200_000_000) {
      maxFee = 100_000;
    } else if (startingPrice <= 500_000_000) {
      maxFee = 200_000;
    } else {
      maxFee = 500_000;
    }

    if (dossierFee > maxFee) {
      return {
        valid: false,
        message: `Dossier fee (${dossierFee.toLocaleString('vi-VN')} VND) exceeds maximum allowed (${maxFee.toLocaleString('vi-VN')} VND) for starting price of ${startingPrice.toLocaleString('vi-VN')} VND`,
        maxAllowed: maxFee,
      };
    }

    return { valid: true };
  }

  /**
   * MODULE 3: Validate Deposit Percentage
   * Percentage must be within allowed range based on asset category
   *
   * @param percentage - The deposit percentage (e.g., 10 for 10%)
   * @param assetCategory - "general" or "land_use_right"
   * @returns Validation result
   */
  validateDepositPercentage(percentage: number, assetCategory: 'general' | 'land_use_right' = 'general'): { valid: boolean; message?: string; range?: { min: number; max: number } } {
    let minPercentage: number;
    let maxPercentage = 20; // Same for both

    if (assetCategory === 'general') {
      minPercentage = 5;
    } else {
      minPercentage = 10; // Land use rights
    }

    if (percentage < minPercentage || percentage > maxPercentage) {
      return {
        valid: false,
        message: `Deposit percentage (${percentage}%) must be between ${minPercentage}% and ${maxPercentage}% for ${assetCategory} assets`,
        range: { min: minPercentage, max: maxPercentage },
      };
    }

    return { valid: true };
  }

  /**
   * MODULE 4: Calculate Total Auction Costs
   * Sum of all variable costs
   */
  calculateTotalCosts(costs: {
    advertisingCost?: number;
    venueRentalCost?: number;
    appraisalCost?: number;
    assetViewingCost?: number;
    otherCosts?: Array<{ description: string; amount: number }>;
  }): number {
    let total = 0;

    total += costs.advertisingCost || 0;
    total += costs.venueRentalCost || 0;
    total += costs.appraisalCost || 0;
    total += costs.assetViewingCost || 0;

    if (costs.otherCosts && Array.isArray(costs.otherCosts)) {
      total += costs.otherCosts.reduce((sum, cost) => sum + (cost.amount || 0), 0);
    }

    return Math.round(total);
  }

  /**
   * COMPREHENSIVE: Calculate complete financial summary after auction finalization
   *
   * @param auctionId - The auction ID
   * @param finalSalePrice - The hammer price
   * @returns Complete financial breakdown
   */
  async calculateAuctionFinancialSummary(auctionId: string, finalSalePrice: number) {
    try {
      // Get auction with policy and costs
      const auction = await this.prisma.auction.findUnique({
        where: { id: auctionId },
        include: {
          auctionPolicy: {
            include: {
              commissionConfig: true,
              dossierConfig: true,
              depositConfig: true,
            },
          },
          costs: true,
        },
      });

      if (!auction) {
        throw new BadRequestException('Auction not found');
      }

      // Determine asset category for calculations
      const assetCategory = auction.assetType === 'land_use_rights' ? 'land_use_right' : 'general';

      // 1. Calculate Commission Fee
      const commissionFee = this.calculateCommission(finalSalePrice, assetCategory);

      // 2. Get Dossier Fee (already set by admin and validated)
      const dossierFee = parseFloat(auction.dossierFee?.toString() || '0');

      // 3. Calculate Deposit Amount (from unified policy config)
      let depositAmount = 0;
      let depositPercentage: number | undefined;
      let depositType: 'percentage' | 'fixed' = 'percentage';

      if (auction.auctionPolicy?.depositConfig) {
        const depositConfig = auction.auctionPolicy.depositConfig;
        depositType = depositConfig.depositType as 'percentage' | 'fixed';

        if (depositType === 'percentage') {
          // Use the actual deposit percentage set for the auction, or fallback to policy min
          depositPercentage = parseFloat(auction.depositPercentage?.toString() || depositConfig.minPercentage?.toString() || '10');
          depositAmount = this.calculateDepositAmount(
            'percentage',
            parseFloat(auction.startingPrice.toString()),
            depositPercentage,
            undefined,
            {
              minDepositAmount: depositConfig.minDepositAmount ? parseFloat(depositConfig.minDepositAmount.toString()) : undefined,
              maxDepositAmount: depositConfig.maxDepositAmount ? parseFloat(depositConfig.maxDepositAmount.toString()) : undefined,
            }
          );
        } else {
          // Fixed deposit
          const fixedAmount = depositConfig.fixedAmount ? parseFloat(depositConfig.fixedAmount.toString()) : 0;
          depositAmount = this.calculateDepositAmount(
            'fixed',
            parseFloat(auction.startingPrice.toString()),
            undefined,
            fixedAmount,
            {
              minDepositAmount: depositConfig.minDepositAmount ? parseFloat(depositConfig.minDepositAmount.toString()) : undefined,
              maxDepositAmount: depositConfig.maxDepositAmount ? parseFloat(depositConfig.maxDepositAmount.toString()) : undefined,
            }
          );
        }
      } else {
        // Fallback for auctions without policy (backward compatibility)
        depositPercentage = parseFloat(auction.depositPercentage?.toString() || '10');
        depositAmount = Math.round((parseFloat(auction.startingPrice.toString()) * depositPercentage) / 100);
      }

      // 4. Get Total Auction Costs
      const totalAuctionCosts = auction.costs
        ? parseFloat(auction.costs.totalCosts.toString())
        : 0;

      // 5. Calculate totals
      const totalFeesToSeller = commissionFee + totalAuctionCosts;
      const netAmountToSeller = finalSalePrice - totalFeesToSeller;

      // 6. Create detailed breakdown
      const calculationDetails = {
        commission: {
          assetCategory,
          finalSalePrice,
          commissionFee,
          calculation: this.getCommissionCalculationSteps(finalSalePrice, assetCategory),
        },
        dossierFee: {
          amount: dossierFee,
          startingPrice: parseFloat(auction.startingPrice.toString()),
        },
        deposit: {
          type: depositType,
          ...(depositType === 'percentage' && { percentage: depositPercentage }),
          ...(depositType === 'fixed' && {
            fixedAmount: auction.auctionPolicy?.depositConfig?.fixedAmount
              ? parseFloat(auction.auctionPolicy.depositConfig.fixedAmount.toString())
              : undefined
          }),
          startingPrice: parseFloat(auction.startingPrice.toString()),
          amount: depositAmount,
        },
        costs: {
          advertisingCost: auction.costs ? parseFloat(auction.costs.advertisingCost?.toString() || '0') : 0,
          venueRentalCost: auction.costs ? parseFloat(auction.costs.venueRentalCost?.toString() || '0') : 0,
          appraisalCost: auction.costs ? parseFloat(auction.costs.appraisalCost?.toString() || '0') : 0,
          assetViewingCost: auction.costs ? parseFloat(auction.costs.assetViewingCost?.toString() || '0') : 0,
          otherCosts: auction.costs?.otherCosts ? JSON.parse(auction.costs.otherCosts as string) : [],
          total: totalAuctionCosts,
        },
        summary: {
          finalSalePrice,
          commissionFee,
          totalAuctionCosts,
          totalFeesToSeller,
          netAmountToSeller,
        },
      };

      // 7. Save or update financial summary
      const financialSummary = await this.prisma.auctionFinancialSummary.upsert({
        where: { auctionId },
        create: {
          auctionId,
          finalSalePrice,
          startingPrice: parseFloat(auction.startingPrice.toString()),
          commissionFee,
          dossierFee,
          depositAmount,
          totalAuctionCosts,
          totalFeesToSeller,
          netAmountToSeller,
          calculationDetails: JSON.stringify(calculationDetails),
        },
        update: {
          finalSalePrice,
          commissionFee,
          dossierFee,
          depositAmount,
          totalAuctionCosts,
          totalFeesToSeller,
          netAmountToSeller,
          calculationDetails: JSON.stringify(calculationDetails),
        },
      });

      this.logger.log(`Financial summary calculated for auction ${auctionId}`);

      return {
        ...calculationDetails.summary,
        details: calculationDetails,
      };
    } catch (error) {
      this.logger.error(`Failed to calculate financial summary for auction ${auctionId}`, error);
      throw error;
    }
  }

  /**
   * Helper: Get step-by-step commission calculation for transparency
   */
  private getCommissionCalculationSteps(finalPrice: number, assetCategory: string): string {
    if (assetCategory === 'general') {
      if (finalPrice <= 50_000_000) {
        return `${finalPrice.toLocaleString('vi-VN')} * 5% = ${(finalPrice * 0.05).toLocaleString('vi-VN')} VND`;
      } else if (finalPrice <= 100_000_000) {
        return `2,500,000 + (${finalPrice.toLocaleString('vi-VN')} - 50,000,000) * 3.5% = ${(2_500_000 + (finalPrice - 50_000_000) * 0.035).toLocaleString('vi-VN')} VND`;
      } else if (finalPrice <= 500_000_000) {
        return `4,250,000 + (${finalPrice.toLocaleString('vi-VN')} - 100,000,000) * 3% = ${(4_250_000 + (finalPrice - 100_000_000) * 0.03).toLocaleString('vi-VN')} VND`;
      } else if (finalPrice <= 1_000_000_000) {
        return `16,250,000 + (${finalPrice.toLocaleString('vi-VN')} - 500,000,000) * 2% = ${(16_250_000 + (finalPrice - 500_000_000) * 0.02).toLocaleString('vi-VN')} VND`;
      } else if (finalPrice <= 5_000_000_000) {
        return `26,250,000 + (${finalPrice.toLocaleString('vi-VN')} - 1,000,000,000) * 1.5% = ${(26_250_000 + (finalPrice - 1_000_000_000) * 0.015).toLocaleString('vi-VN')} VND`;
      } else if (finalPrice <= 10_000_000_000) {
        return `86,250,000 + (${finalPrice.toLocaleString('vi-VN')} - 5,000,000,000) * 0.2% = ${(86_250_000 + (finalPrice - 5_000_000_000) * 0.002).toLocaleString('vi-VN')} VND`;
      } else {
        return `96,250,000 + (${finalPrice.toLocaleString('vi-VN')} - 10,000,000,000) * 0.1% = ${(96_250_000 + (finalPrice - 10_000_000_000) * 0.001).toLocaleString('vi-VN')} VND`;
      }
    } else {
      if (finalPrice <= 5_000_000_000) {
        return `50,000,000 + (${finalPrice.toLocaleString('vi-VN')} - 0) * 0.45% = ${(50_000_000 + finalPrice * 0.0045).toLocaleString('vi-VN')} VND`;
      } else if (finalPrice <= 10_000_000_000) {
        return `72,500,000 + (${finalPrice.toLocaleString('vi-VN')} - 5,000,000,000) * 0.15% = ${(72_500_000 + (finalPrice - 5_000_000_000) * 0.0015).toLocaleString('vi-VN')} VND`;
      } else {
        return `80,000,000 + (${finalPrice.toLocaleString('vi-VN')} - 10,000,000,000) * 0.1% = ${(80_000_000 + (finalPrice - 10_000_000_000) * 0.001).toLocaleString('vi-VN')} VND`;
      }
    }
  }

  /**
   * Calculate deposit amount based on policy configuration
   */
  calculateDepositAmount(
    depositType: 'percentage' | 'fixed',
    startingPrice: number,
    percentage?: number,
    fixedAmount?: number,
    constraints?: {
      minDepositAmount?: number;
      maxDepositAmount?: number;
    }
  ): number {
    let depositAmount: number;

    if (depositType === 'percentage') {
      if (!percentage) {
        throw new Error('Percentage is required for percentage-based deposits');
      }
      depositAmount = (startingPrice * percentage) / 100;
    } else {
      if (!fixedAmount) {
        throw new Error('Fixed amount is required for fixed deposits');
      }
      depositAmount = fixedAmount;
    }

    // Apply constraints
    if (constraints?.minDepositAmount && depositAmount < constraints.minDepositAmount) {
      depositAmount = constraints.minDepositAmount;
    }

    if (constraints?.maxDepositAmount && depositAmount > constraints.maxDepositAmount) {
      depositAmount = constraints.maxDepositAmount;
    }

    return depositAmount;
  }

  /**
   * Validate deposit configuration
   */
  validateDepositConfig(
    depositType: 'percentage' | 'fixed',
    assetCategory?: string,
    percentage?: number,
    fixedAmount?: number
  ): { valid: boolean; message?: string } {
    if (depositType === 'percentage') {
      if (!assetCategory) {
        return {
          valid: false,
          message: 'Asset category is required for percentage deposits',
        };
      }

      if (percentage === undefined) {
        return {
          valid: false,
          message: 'Percentage is required for percentage deposits',
        };
      }

      // Validate against asset category rules
      const validation = this.validateDepositPercentage(
        percentage,
        assetCategory as 'general' | 'land_use_right'
      );
      return validation;
    } else {
      if (!fixedAmount || fixedAmount <= 0) {
        return {
          valid: false,
          message: 'Valid fixed amount is required for fixed deposits',
        };
      }

      return { valid: true };
    }
  }
}
