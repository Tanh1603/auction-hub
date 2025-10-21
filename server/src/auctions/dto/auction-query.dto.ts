import { IsOptional, IsEnum } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export enum AuctionQueryStatus {
  COMPLETED = 'completed',
  NOW = 'now',
  UPCOMING = 'upcoming',
}

export class AuctionQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(AuctionQueryStatus)
  status?: AuctionQueryStatus;
}
