import { PartialType } from '@nestjs/swagger';
import { CreateAuctionPolicyDto } from './create-auction-policy.dto';
import { IsOptional } from 'class-validator';

export class UpdateAuctionPolicyDto extends PartialType(CreateAuctionPolicyDto) {
  // All fields from CreateAuctionPolicyDto are now optional
}
