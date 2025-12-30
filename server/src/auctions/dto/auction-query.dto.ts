import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { AssetType } from '../../../generated';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export enum AuctionQueryStatus {
  COMPLETED = 'completed',
  NOW = 'now',
  UPCOMING = 'upcoming',
}

export class AuctionQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter auctions by status',
    enum: AuctionQueryStatus,
  })
  @IsOptional()
  @IsEnum(AuctionQueryStatus)
  status?: AuctionQueryStatus;

  @ApiPropertyOptional({
    description: 'Search by auction name',
    type: String,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    enum: AssetType,
  })
  @IsOptional()
  @IsEnum(AssetType)
  auctionType?: AssetType;

  @ApiPropertyOptional({
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assetWardId?: number;

  @ApiPropertyOptional({
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assetProvinceId?: number;
}
