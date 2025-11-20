import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

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
    description: 'Whether the auction is active',
    type: Boolean,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  active: boolean;
}
