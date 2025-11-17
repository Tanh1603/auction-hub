import { IsNumber, IsNotEmpty, IsPositive, IsEnum, IsOptional, IsString, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AssetCategoryDto {
  GENERAL = 'general',
  LAND_USE_RIGHT = 'land_use_right',
}

export class ValidateDossierFeeDto {
  @ApiProperty({ example: 100000 })
  @IsNumber()
  @IsNotEmpty()
  @IsPositive()
  dossierFee: number;

  @ApiProperty({ example: 150000000 })
  @IsNumber()
  @IsNotEmpty()
  @IsPositive()
  startingPrice: number;
}

export class ValidateDepositPercentageDto {
  @ApiProperty({ example: 10 })
  @IsNumber()
  @IsNotEmpty()
  @IsPositive()
  percentage: number;

  @ApiProperty({ enum: AssetCategoryDto, default: AssetCategoryDto.GENERAL })
  @IsEnum(AssetCategoryDto)
  assetCategory: AssetCategoryDto;
}

export class CalculateCommissionDto {
  @ApiProperty({ example: 2500000000, description: 'Final sale price (hammer price)' })
  @IsNumber()
  @IsNotEmpty()
  @IsPositive()
  finalPrice: number;

  @ApiProperty({ enum: AssetCategoryDto, default: AssetCategoryDto.GENERAL })
  @IsEnum(AssetCategoryDto)
  assetCategory: AssetCategoryDto;
}

export class CalculateDepositDto {
  @ApiProperty({ example: 'percentage', enum: ['percentage', 'fixed'] })
  @IsEnum(['percentage', 'fixed'])
  depositType: 'percentage' | 'fixed';

  @ApiProperty({ example: 10000000, description: 'Starting price of the auction' })
  @IsNumber()
  @Min(0)
  startingPrice: number;

  @ApiPropertyOptional({ example: 10, description: 'Percentage (for percentage deposits)' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  percentage?: number;

  @ApiPropertyOptional({ example: 5000000, description: 'Fixed amount (for fixed deposits)' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  fixedAmount?: number;

  @ApiPropertyOptional({ example: 'general', enum: AssetCategoryDto })
  @IsString()
  @IsOptional()
  assetCategory?: string;
}
