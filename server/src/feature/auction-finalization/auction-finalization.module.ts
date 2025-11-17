import { Module } from '@nestjs/common';
import { AuctionFinalizationService } from './auction-finalization.service';
import { AuctionFinalizationController } from './auction-finalization.controller';
import { AuctionEvaluationService } from './services/auction-evaluation.service';
import { AuctionOwnerService } from './services/auction-owner.service';
import { WinnerPaymentService } from './services/winner-payment.service';
import { AuctionResultsService } from './services/auction-results.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { BiddingGateway } from '../bidding/bidding.gateway';
import { AuctionPolicyModule } from '../auction-policy/auction-policy.module';
import { PaymentModule } from '../../payment/payment.module';

@Module({
  imports: [PrismaModule, AuctionPolicyModule, PaymentModule],
  controllers: [AuctionFinalizationController],
  providers: [
    AuctionFinalizationService,
    AuctionEvaluationService,
    AuctionOwnerService,
    WinnerPaymentService,
    AuctionResultsService,
    BiddingGateway,
  ],
  exports: [AuctionFinalizationService],
})
export class AuctionFinalizationModule {}
