import { IsNumber, IsOptional, IsArray, ValidateNested, IsString, IsNotEmpty, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OtherCostItem {
  @ApiProperty({ example: 'Security personnel for 3 days' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 5000000 })
  @IsNumber()
  @Min(0)
  amount: number;
}

export class CreateAuctionCostDto {
  @ApiPropertyOptional({ example: 2000000, description: 'Advertising and publication costs' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  advertisingCost?: number;

  @ApiPropertyOptional({ example: 5000000, description: 'Venue rental costs' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  venueRentalCost?: number;

  @ApiPropertyOptional({ example: 10000000, description: 'Asset appraisal costs' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  appraisalCost?: number;

  @ApiPropertyOptional({ example: 1000000, description: 'Asset viewing/inspection costs' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  assetViewingCost?: number;

  @ApiPropertyOptional({ type: [OtherCostItem], description: 'Other miscellaneous costs' })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => OtherCostItem)
  otherCosts?: OtherCostItem[];
}
