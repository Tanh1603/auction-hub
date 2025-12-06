import { IsUUID, IsOptional, IsString, IsBoolean } from 'class-validator';

export class FinalizeAuctionDto {
  @IsUUID('4')
  auctionId: string;

  @IsUUID('4')
  @IsOptional()
  winningBidId?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  skipAutoEvaluation?: boolean;
}
