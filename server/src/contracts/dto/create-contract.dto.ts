import { IsUUID, IsNumber, IsPositive, IsOptional, IsString } from 'class-validator';

export class CreateContractDto {
  @IsUUID()
  auctionId: string;

  @IsUUID()
  winningBidId: string;

  @IsUUID()
  buyerUserId: string;

  @IsNumber()
  @IsPositive()
  price: number;

  @IsOptional()
  @IsString()
  docUrl?: string;
}

