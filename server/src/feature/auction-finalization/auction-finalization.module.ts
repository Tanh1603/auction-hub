import { Module } from '@nestjs/common';
import { AuctionFinalizationService } from './auction-finalization.service';
import { AuctionFinalizationController } from './auction-finalization.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { BiddingGateway } from '../bidding/bidding.gateway';
import { AuctionPolicyModule } from '../auction-policy/auction-policy.module';
import { PaymentModule } from '../../payment/payment.module';

@Module({
  imports: [PrismaModule, AuctionPolicyModule, PaymentModule],
  controllers: [AuctionFinalizationController],
  providers: [AuctionFinalizationService, BiddingGateway],
  exports: [AuctionFinalizationService],
})
export class AuctionFinalizationModule {}
