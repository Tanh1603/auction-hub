import { ApiProperty } from '@nestjs/swagger';
import { Decimal } from '../../../generated/runtime/library';

export class AucitonSummaryDto {
  @ApiProperty({
    description: 'Auction ID',
  })
  id: string;

  @ApiProperty({
    description: 'Auction name',
  })
  name: string;

  @ApiProperty({
    description: 'Starting price of the auction',
    type: String,
  })
  startingPrice: Decimal;

  @ApiProperty({
    description: 'Required deposit amount',
    type: String,
  })
  depositAmountRequired: Decimal;

  @ApiProperty({
    description: 'Auction start date',
    type: String,
    format: 'date-time',
  })
  auctionStartAt: Date;
}
