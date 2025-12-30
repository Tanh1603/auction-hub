import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ArticleType } from '../../../generated';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export enum AuctionQueryStatus {
  COMPLETED = 'completed',
  NOW = 'now',
  UPCOMING = 'upcoming',
}

export class ArticleQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ArticleType,
  })
  @IsOptional()
  @IsEnum(ArticleType)
  type?: ArticleType;

  @ApiPropertyOptional({
    type: String,
  })
  @IsOptional()
  title?: string;
}
