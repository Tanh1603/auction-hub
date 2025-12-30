import { IsUUID, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateManualBidDto {
  @IsUUID('4')
  auctionId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;
}
