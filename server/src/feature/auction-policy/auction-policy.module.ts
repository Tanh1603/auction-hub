import { Module } from '@nestjs/common';
import { AuctionPolicyController } from './auction-policy.controller';
import { AuctionPolicyService } from './auction-policy.service';
import { PolicyCalculationService } from './policy-calculation.service';
import { AuctionCostController } from './auction-cost.controller';
import { AuctionCostService } from './auction-cost.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AuctionPolicyController, AuctionCostController],
  providers: [AuctionPolicyService, PolicyCalculationService, AuctionCostService],
  exports: [AuctionPolicyService, PolicyCalculationService, AuctionCostService],
})
export class AuctionPolicyModule {}
