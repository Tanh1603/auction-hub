import { Module, forwardRef } from '@nestjs/common';
import { ManualBidService } from './manual-bid.service';
import { ManualBidController } from './manual-bid.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { BiddingGateway } from '../bidding.gateway';

@Module({
  imports: [PrismaModule],
  controllers: [ManualBidController],
  providers: [ManualBidService, BiddingGateway],
  exports: [BiddingGateway],
})
export class ManualBidModule {}
