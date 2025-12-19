import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional } from 'class-validator';
import { AssetType } from '../../../../generated';

/**
 * DTO for filtering dashboard analytics data.
 * All filters are optional - omitting filters returns aggregated data for all records.
 */
export class DashboardFiltersDto {
  @ApiPropertyOptional({
    description: 'Start date for the analytics period (ISO 8601 format)',
    example: '2024-01-01',
    type: String,
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for the analytics period (ISO 8601 format)',
    example: '2024-12-31',
    type: String,
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by asset type',
    enum: AssetType,
  })
  @IsOptional()
  @IsEnum(AssetType)
  assetType?: AssetType;

  @ApiPropertyOptional({
    description: 'Filter by province ID',
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  provinceId?: number;
}
