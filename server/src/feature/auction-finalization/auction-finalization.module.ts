import { Module } from '@nestjs/common';
import { AuctionFinalizationService } from './auction-finalization.service';
import { AuctionFinalizationController } from './auction-finalization.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { BiddingGateway } from '../bidding/bidding.gateway';

@Module({
  imports: [PrismaModule],
  controllers: [AuctionFinalizationController],
  providers: [AuctionFinalizationService, BiddingGateway],
  exports: [AuctionFinalizationService],
})
export class AuctionFinalizationModule {}
