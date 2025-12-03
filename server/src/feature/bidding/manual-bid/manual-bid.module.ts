import { Module, forwardRef } from '@nestjs/common';
import { ManualBidService } from './manual-bid.service';
import { ManualBidController } from './manual-bid.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { BiddingModule } from '../bidding.module';

@Module({
  imports: [PrismaModule, forwardRef(() => BiddingModule)],
  controllers: [ManualBidController],
  providers: [ManualBidService],
  exports: [ManualBidService],
})
export class ManualBidModule {}
