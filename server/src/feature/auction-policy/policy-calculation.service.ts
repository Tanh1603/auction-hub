import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JSONUtils } from '../../common/utils/json.utils';
import { SystemVariablesService } from '../../common/services/system-variables.service';

/**
 * Policy Calculation Service
 * Implements all business logic from Vietnamese legal circulars:
 * - Circular 45/2017: Commission/Remuneration (HARDCODED - never changes)
 * - Circular 108/2020: Updates to commission (HARDCODED - never changes)
 * - Circular 48/2017: Dossier fees and deposits (uses system variables for limits)
 *
 * NOTE: Commission calculation tiers are HARDCODED by law and should NOT be moved to database.
 * Only variable settings (deposit percentages, deadlines, etc.) use system variables.
 */
@Injectable()
export class PolicyCalculationService {
  private readonly logger = new Logger(PolicyCalculationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sysVars: SystemVariablesService
  ) {}

  /**
   * MODULE 1: Calculate Commission/Remuneration Fee
   * Based on final sale price with progressive (tiered) calculation
   *
   * HARDCODED TIERS - Defined by Circular 45/2017 & 108/2020
   * These are LEGAL REQUIREMENTS and should NOT be moved to database
   *
   * @param finalPrice - The hammer price (final sale price)
   * @param assetCategory - "general" or "land_use_right"
   * @returns Commission fee in VND
   */
  async calculateCommission(
    finalPrice: number,
    assetCategory: 'general' | 'land_use_right' = 'general'
  ): Promise<number> {
    // ✅ FIX: Validate financial input
    this.validateFinancialValue(finalPrice, 'Final price');

    let commission = 0;

    // HARDCODED LEGAL TIERS - DO NOT MOVE TO DATABASE
    if (assetCategory === 'general') {
      // Table 1.1: General Assets (Circular 45/2017, 108/2020)
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
      // Table 1.2: Land Use Rights (Circular 45/2017, 108/2020)
      if (finalPrice <= 5_000_000_000) {
        commission = 50_000_000 + finalPrice * 0.0045;
      } else if (finalPrice <= 10_000_000_000) {
        commission = 72_500_000 + (finalPrice - 5_000_000_000) * 0.0015;
      } else {
        commission = 80_000_000 + (finalPrice - 10_000_000_000) * 0.001;
      }
    }

    // Apply min and max constraints from system variables
    const minCommission = await this.sysVars.get<number>(
      'commission',
      'commission.min_amount'
    );
    const maxCommission = await this.sysVars.get<number>(
      'commission',
      'commission.max_amount'
    );

    commission = Math.max(commission, minCommission);
    commission = Math.min(commission, maxCommission);

    // ✅ FIX: Round to nearest VND (no decimal places)
    return this.roundVND(commission);
  }

  /**
   * MODULE 2: Validate Dossier Fee
   * Fee must comply with maximum limits based on starting price
   * Uses system variables for tier limits
   *
   * @param dossierFee - The proposed dossier fee
   * @param startingPrice - The auction starting price
   * @returns Validation result with error message if invalid
   */
  async validateDossierFee(
    dossierFee: number,
    startingPrice: number
  ): Promise<{ valid: boolean; message?: string; maxAllowed?: number }> {
    // ✅ FIX: Validate inputs
    this.validateFinancialValue(dossierFee, 'Dossier fee');
    this.validateFinancialValue(startingPrice, 'Starting price');

    // Get tier limits from system variables (Circular 48/2017)
    const tier1Max = await this.sysVars.get<number>(
      'dossier',
      'dossier.tier1_max'
    );
    const tier1Fee = await this.sysVars.get<number>(
      'dossier',
      'dossier.tier1_fee'
    );
    const tier2Max = await this.sysVars.get<number>(
      'dossier',
      'dossier.tier2_max'
    );
    const tier2Fee = await this.sysVars.get<number>(
      'dossier',
      'dossier.tier2_fee'
    );
    const tier3Fee = await this.sysVars.get<number>(
      'dossier',
      'dossier.tier3_fee'
    );

    let maxFee: number;
    if (startingPrice <= tier1Max) {
      maxFee = tier1Fee;
    } else if (startingPrice <= tier2Max) {
      maxFee = tier2Fee;
    } else {
      maxFee = tier3Fee;
    }

    if (dossierFee > maxFee) {
      return {
        valid: false,
        message: `Dossier fee (${dossierFee.toLocaleString(
          'vi-VN'
        )} VND) exceeds maximum allowed (${maxFee.toLocaleString(
          'vi-VN'
        )} VND) for starting price of ${startingPrice.toLocaleString(
          'vi-VN'
        )} VND`,
        maxAllowed: maxFee,
      };
    }

    return { valid: true };
  }

  /**
   * MODULE 3: Validate Deposit Percentage
   * Percentage must be within allowed range based on asset category
   * Uses system variables for min/max ranges
   *
   * @param percentage - The deposit percentage (e.g., 10 for 10%)
   * @param assetCategory - "general" or "land_use_right"
   * @returns Validation result
   */
  async validateDepositPercentage(
    percentage: number,
    assetCategory: 'general' | 'land_use_right' = 'general'
  ): Promise<{
    valid: boolean;
    message?: string;
    range?: { min: number; max: number };
  }> {
    const categoryPrefix = assetCategory === 'general' ? 'general' : 'land';

    // Get deposit percentage ranges from system variables (Circular 48/2017)
    const minPercentage = await this.sysVars.get<number>(
      'deposit',
      `deposit.${categoryPrefix}.min_percentage`
    );
    const maxPercentage = await this.sysVars.get<number>(
      'deposit',
      `deposit.${categoryPrefix}.max_percentage`
    );

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
      total += costs.otherCosts.reduce(
        (sum, cost) => sum + (cost.amount || 0),
        0
      );
    }

    return Math.round(total);
  }

  /**
   * COMPREHENSIVE: Calculate complete financial summary after auction finalization
   * NO LONGER REQUIRES POLICY - Uses system variables and auction data directly
   *
   * @param auctionId - The auction ID
   * @param finalSalePrice - The hammer price
   * @returns Complete financial breakdown
   */
  async calculateAuctionFinancialSummary(
    auctionId: string,
    finalSalePrice: number
  ) {
    try {
      // Get auction with costs only (no policy needed!)
      const auction = await this.prisma.auction.findUnique({
        where: { id: auctionId },
        include: {
          costs: true,
        },
      });

      if (!auction) {
        throw new BadRequestException('Auction not found');
      }

      // ✅ Asset type mapping with validation
      const ASSET_TYPE_MAP: Record<string, 'general' | 'land_use_right'> = {
        land_use_rights: 'land_use_right',
        land_use_right: 'land_use_right',
        real_estate: 'general',
        vehicle: 'general',
        machinery: 'general',
        other: 'general',
        GENERAL: 'general',
      };

      const assetCategory = ASSET_TYPE_MAP[auction.assetType];
      if (!assetCategory) {
        this.logger.warn(
          `Unknown asset type: ${auction.assetType}, defaulting to 'general'`
        );
      }
      const finalAssetCategory = assetCategory || 'general';

      // 1. Calculate Commission Fee (uses hardcoded legal tiers + system var limits)
      const commissionFee = await this.calculateCommission(
        finalSalePrice,
        finalAssetCategory
      );

      // 2. Get Dossier Fee (already set by admin and validated)
      const dossierFee = parseFloat(auction.dossierFee?.toString() || '0');

      // 3. Calculate Deposit Amount (from auction data + system variables)
      let depositAmount = 0;
      let depositPercentage: number | undefined;
      const depositType: 'percentage' | 'fixed' = 'percentage';

      // Use the deposit percentage set on the auction
      depositPercentage = parseFloat(
        auction.depositPercentage?.toString() || '10'
      );

      // Get min deposit amount from system variables
      const minDepositAmount = await this.sysVars.get<number>(
        'deposit',
        'deposit.min_amount'
      );

      depositAmount = await this.calculateDepositAmount(
        'percentage',
        parseFloat(auction.startingPrice.toString()),
        depositPercentage,
        undefined,
        {
          minDepositAmount,
          maxDepositAmount: undefined,
        }
      );

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
          assetCategory: finalAssetCategory,
          finalSalePrice,
          commissionFee,
          calculation: this.getCommissionCalculationSteps(
            finalSalePrice,
            finalAssetCategory
          ),
        },
        dossierFee: {
          amount: dossierFee,
          startingPrice: parseFloat(auction.startingPrice.toString()),
        },
        deposit: {
          type: depositType,
          ...(depositType === 'percentage' && {
            percentage: depositPercentage,
          }),
          ...(depositType === 'fixed' && {
            fixedAmount: auction.auctionPolicy?.depositConfig?.fixedAmount
              ? parseFloat(
                  auction.auctionPolicy.depositConfig.fixedAmount.toString()
                )
              : undefined,
          }),
          startingPrice: parseFloat(auction.startingPrice.toString()),
          amount: depositAmount,
        },
        costs: {
          advertisingCost: auction.costs
            ? parseFloat(auction.costs.advertisingCost?.toString() || '0')
            : 0,
          venueRentalCost: auction.costs
            ? parseFloat(auction.costs.venueRentalCost?.toString() || '0')
            : 0,
          appraisalCost: auction.costs
            ? parseFloat(auction.costs.appraisalCost?.toString() || '0')
            : 0,
          assetViewingCost: auction.costs
            ? parseFloat(auction.costs.assetViewingCost?.toString() || '0')
            : 0,
          // ✅ FIX: Use safe JSON parsing with fallback
          otherCosts: JSONUtils.parseArray(
            auction.costs?.otherCosts as string,
            'other costs'
          ),
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
      const financialSummary = await this.prisma.auctionFinancialSummary.upsert(
        {
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
        }
      );

      this.logger.log(`Financial summary calculated for auction ${auctionId}`);

      return {
        ...calculationDetails.summary,
        details: calculationDetails,
      };
    } catch (error) {
      this.logger.error(
        `Failed to calculate financial summary for auction ${auctionId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Helper: Get step-by-step commission calculation for transparency
   */
  private getCommissionCalculationSteps(
    finalPrice: number,
    assetCategory: string
  ): string {
    if (assetCategory === 'general') {
      if (finalPrice <= 50_000_000) {
        return `${finalPrice.toLocaleString('vi-VN')} * 5% = ${(
          finalPrice * 0.05
        ).toLocaleString('vi-VN')} VND`;
      } else if (finalPrice <= 100_000_000) {
        return `2,500,000 + (${finalPrice.toLocaleString(
          'vi-VN'
        )} - 50,000,000) * 3.5% = ${(
          2_500_000 +
          (finalPrice - 50_000_000) * 0.035
        ).toLocaleString('vi-VN')} VND`;
      } else if (finalPrice <= 500_000_000) {
        return `4,250,000 + (${finalPrice.toLocaleString(
          'vi-VN'
        )} - 100,000,000) * 3% = ${(
          4_250_000 +
          (finalPrice - 100_000_000) * 0.03
        ).toLocaleString('vi-VN')} VND`;
      } else if (finalPrice <= 1_000_000_000) {
        return `16,250,000 + (${finalPrice.toLocaleString(
          'vi-VN'
        )} - 500,000,000) * 2% = ${(
          16_250_000 +
          (finalPrice - 500_000_000) * 0.02
        ).toLocaleString('vi-VN')} VND`;
      } else if (finalPrice <= 5_000_000_000) {
        return `26,250,000 + (${finalPrice.toLocaleString(
          'vi-VN'
        )} - 1,000,000,000) * 1.5% = ${(
          26_250_000 +
          (finalPrice - 1_000_000_000) * 0.015
        ).toLocaleString('vi-VN')} VND`;
      } else if (finalPrice <= 10_000_000_000) {
        return `86,250,000 + (${finalPrice.toLocaleString(
          'vi-VN'
        )} - 5,000,000,000) * 0.2% = ${(
          86_250_000 +
          (finalPrice - 5_000_000_000) * 0.002
        ).toLocaleString('vi-VN')} VND`;
      } else {
        return `96,250,000 + (${finalPrice.toLocaleString(
          'vi-VN'
        )} - 10,000,000,000) * 0.1% = ${(
          96_250_000 +
          (finalPrice - 10_000_000_000) * 0.001
        ).toLocaleString('vi-VN')} VND`;
      }
    } else {
      if (finalPrice <= 5_000_000_000) {
        return `50,000,000 + (${finalPrice.toLocaleString(
          'vi-VN'
        )} - 0) * 0.45% = ${(50_000_000 + finalPrice * 0.0045).toLocaleString(
          'vi-VN'
        )} VND`;
      } else if (finalPrice <= 10_000_000_000) {
        return `72,500,000 + (${finalPrice.toLocaleString(
          'vi-VN'
        )} - 5,000,000,000) * 0.15% = ${(
          72_500_000 +
          (finalPrice - 5_000_000_000) * 0.0015
        ).toLocaleString('vi-VN')} VND`;
      } else {
        return `80,000,000 + (${finalPrice.toLocaleString(
          'vi-VN'
        )} - 10,000,000,000) * 0.1% = ${(
          80_000_000 +
          (finalPrice - 10_000_000_000) * 0.001
        ).toLocaleString('vi-VN')} VND`;
      }
    }
  }

  /**
   * Calculate deposit amount based on policy configuration
   * Uses system variables for constraints
   */
  async calculateDepositAmount(
    depositType: 'percentage' | 'fixed',
    startingPrice: number,
    percentage?: number,
    fixedAmount?: number,
    constraints?: {
      minDepositAmount?: number;
      maxDepositAmount?: number;
    }
  ): Promise<number> {
    // ✅ FIX: Validate starting price
    this.validateFinancialValue(startingPrice, 'Starting price');

    let depositAmount: number;

    if (depositType === 'percentage') {
      if (!percentage) {
        throw new BadRequestException(
          'Percentage is required for percentage-based deposits'
        );
      }
      // ✅ FIX: Validate percentage
      if (percentage <= 0 || percentage > 100) {
        throw new BadRequestException('Percentage must be between 0 and 100');
      }
      depositAmount = (startingPrice * percentage) / 100;
    } else {
      if (!fixedAmount) {
        throw new BadRequestException(
          'Fixed amount is required for fixed deposits'
        );
      }
      // ✅ FIX: Validate fixed amount
      this.validateFinancialValue(fixedAmount, 'Fixed deposit amount');
      depositAmount = fixedAmount;
    }

    // Apply constraints
    if (constraints?.minDepositAmount) {
      this.validateFinancialValue(
        constraints.minDepositAmount,
        'Minimum deposit amount'
      );
      if (depositAmount < constraints.minDepositAmount) {
        depositAmount = constraints.minDepositAmount;
      }
    }

    if (constraints?.maxDepositAmount) {
      this.validateFinancialValue(
        constraints.maxDepositAmount,
        'Maximum deposit amount'
      );
      if (depositAmount > constraints.maxDepositAmount) {
        depositAmount = constraints.maxDepositAmount;
      }
    }

    // ✅ FIX: Round to nearest VND
    return this.roundVND(depositAmount);
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

  /**
   * ✅ FIX: Validate financial values
   * Ensures values are positive, finite numbers
   * @param value - The financial value to validate
   * @param fieldName - Name of the field for error messages
   * @throws BadRequestException if invalid
   */
  private validateFinancialValue(value: number, fieldName: string): void {
    if (typeof value !== 'number') {
      throw new BadRequestException(`${fieldName} must be a number`);
    }

    if (isNaN(value)) {
      throw new BadRequestException(`${fieldName} is not a valid number (NaN)`);
    }

    if (!isFinite(value)) {
      throw new BadRequestException(
        `${fieldName} must be a finite number (not Infinity)`
      );
    }

    if (value < 0) {
      throw new BadRequestException(`${fieldName} cannot be negative`);
    }
  }

  /**
   * ✅ FIX: Round amount to nearest VND (no decimal places)
   * VND does not use decimal places
   * @param amount - The amount to round
   * @returns Rounded amount
   */
  private roundVND(amount: number): number {
    return Math.round(amount);
  }
}
