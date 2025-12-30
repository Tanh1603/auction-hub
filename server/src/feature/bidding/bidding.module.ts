import { Module } from '@nestjs/common';
import { ManualBidModule } from './manual-bid/manual-bid.module';
import { RegisterToBidModule } from './register-to-bid/register-to-bid.module';
import { BiddingGateway } from './bidding.gateway';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule, ManualBidModule, RegisterToBidModule],
  providers: [BiddingGateway],
  exports: [BiddingGateway],
})
export class BiddingModule {}
