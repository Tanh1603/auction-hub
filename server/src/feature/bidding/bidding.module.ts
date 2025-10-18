
import { Module } from '@nestjs/common';
import { ManualBidModule } from './manual-bid/manual-bid.module';
import { RegisterToBidModule } from './register-to-bid/register-to-bid.module';

@Module({
  imports: [ManualBidModule, RegisterToBidModule],
})
export class BiddingModule {}
