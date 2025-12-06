import { Module } from '@nestjs/common';
import { PolicyCalculationService } from './policy-calculation.service';
import { AuctionCostController } from './auction-cost.controller';
import { AuctionCostService } from './auction-cost.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { SystemVariablesService } from '../../common/services/system-variables.service';

/**
 * Auction Policy Module
 * Manages auction costs and policy calculations using system variables
 * Note: Policy CRUD moved to SystemVariablesController in CommonModule
 */
@Module({
  imports: [PrismaModule],
  controllers: [AuctionCostController],
  providers: [
    PolicyCalculationService,
    AuctionCostService,
    SystemVariablesService,
  ],
  exports: [
    PolicyCalculationService,
    AuctionCostService,
    SystemVariablesService,
  ],
})
export class AuctionPolicyModule {}
