import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsArray,
  IsNumber,
  ValidateNested,
  IsNotEmpty,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AssetOwnershipDto {
  STATE_OWNED = 'state_owned',
  PRIVATE = 'private',
}

export enum AssetCategoryDto {
  GENERAL = 'general',
  LAND_USE_RIGHT = 'land_use_right',
}

export class CommissionTier {
  @ApiProperty({ example: 0 })
  @IsNumber()
  from: number;

  @ApiProperty({ example: 50000000 })
  @IsNumber()
  to: number;

  @ApiProperty({ example: 0.05, description: 'Rate as decimal (e.g., 0.05 for 5%)' })
  @IsNumber()
  rate: number;

  @ApiProperty({ example: 0 })
  @IsNumber()
  baseAmount: number;
}

export class DossierFeeTier {
  @ApiProperty({ example: 0 })
  @IsNumber()
  startPriceFrom: number;

  @ApiProperty({ example: 200000000 })
  @IsNumber()
  startPriceTo: number;

  @ApiProperty({ example: 100000 })
  @IsNumber()
  maxFee: number;
}

export class CommissionConfigDto {
  @ApiProperty({ enum: AssetCategoryDto, default: AssetCategoryDto.GENERAL })
  @IsEnum(AssetCategoryDto)
  assetCategory: AssetCategoryDto;

  @ApiProperty({ type: [CommissionTier] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommissionTier)
  tiers: CommissionTier[];

  @ApiPropertyOptional({ example: 1000000 })
  @IsNumber()
  @IsOptional()
  minCommission?: number;

  @ApiPropertyOptional({ example: 400000000 })
  @IsNumber()
  @IsOptional()
  maxCommission?: number;
}

export class DossierFeeConfigDto {
  @ApiProperty({ type: [DossierFeeTier] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DossierFeeTier)
  feeTiers: DossierFeeTier[];
}

export class DepositConfigDto {
  @ApiProperty({
    enum: ['percentage', 'fixed'],
    example: 'percentage',
    description: 'Type of deposit calculation',
  })
  @IsEnum(['percentage', 'fixed'])
  depositType: 'percentage' | 'fixed';

  @ApiPropertyOptional({
    example: 'general',
    enum: AssetCategoryDto,
    description: 'Required for percentage deposits',
  })
  @IsString()
  @IsOptional()
  assetCategory?: string;

  @ApiPropertyOptional({
    example: 10,
    description: 'Minimum percentage (for percentage deposits)',
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  minPercentage?: number;

  @ApiPropertyOptional({
    example: 20,
    description: 'Maximum percentage (for percentage deposits)',
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  maxPercentage?: number;

  @ApiPropertyOptional({
    example: 5000000,
    description: 'Fixed deposit amount (for fixed deposits)',
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  fixedAmount?: number;

  @ApiPropertyOptional({
    example: 100000,
    description: 'Minimum deposit amount (constraint for both types)',
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  minDepositAmount?: number;

  @ApiPropertyOptional({
    example: 10000000,
    description: 'Maximum deposit amount (constraint for both types)',
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  maxDepositAmount?: number;

  @ApiPropertyOptional({
    example: 24,
    description: 'Hours before auction start to pay deposit',
  })
  @IsNumber()
  @IsOptional()
  @Min(1)
  depositDeadlineHours?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether documents are required',
  })
  @IsBoolean()
  @IsOptional()
  requiresDocuments?: boolean;

  @ApiPropertyOptional({
    example: ['identity_card', 'business_license'],
    type: [String],
    description: 'Required document types',
  })
  @IsArray()
  @IsOptional()
  requiredDocumentTypes?: string[];

  @ApiPropertyOptional({
    example: 3,
    description: 'Working days to process refunds',
  })
  @IsNumber()
  @IsOptional()
  @Min(1)
  refundDeadlineDays?: number;
}

export class CreateAuctionPolicyDto {
  @ApiProperty({ example: 'Standard State-Owned Policy (Circular 45/2017)' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Policy compliant with Vietnamese regulations' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: AssetOwnershipDto, default: AssetOwnershipDto.STATE_OWNED })
  @IsEnum(AssetOwnershipDto)
  assetOwnership: AssetOwnershipDto;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @ApiPropertyOptional({ type: CommissionConfigDto })
  @ValidateNested()
  @Type(() => CommissionConfigDto)
  @IsOptional()
  commissionConfig?: CommissionConfigDto;

  @ApiPropertyOptional({ type: DossierFeeConfigDto })
  @ValidateNested()
  @Type(() => DossierFeeConfigDto)
  @IsOptional()
  dossierConfig?: DossierFeeConfigDto;

  @ApiPropertyOptional({ type: DepositConfigDto })
  @ValidateNested()
  @Type(() => DepositConfigDto)
  @IsOptional()
  depositConfig?: DepositConfigDto;
}
