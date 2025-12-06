import { PartialType } from '@nestjs/swagger';
import { CreateAuctionCostDto } from './create-auction-cost.dto';

export class UpdateAuctionCostDto extends PartialType(CreateAuctionCostDto) {
  // All fields from CreateAuctionCostDto are now optional
}
