import { IsUUID, IsEnum, IsString, IsOptional } from 'class-validator';
import { AuctionStatus } from '../../../../generated';

export class OverrideAuctionStatusDto {
  @IsUUID('4')
  auctionId: string;

  @IsEnum(AuctionStatus)
  newStatus: AuctionStatus;

  @IsString()
  reason: string;

  @IsUUID('4')
  @IsOptional()
  winningBidId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
