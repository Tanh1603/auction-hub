import { Module } from '@nestjs/common';
import { ManualBidService } from './manual-bid.service';
import { ManualBidController } from './manual-bid.controller';

@Module({
  controllers: [ManualBidController],
  providers: [ManualBidService],
})
export class ManualBidModule {}
