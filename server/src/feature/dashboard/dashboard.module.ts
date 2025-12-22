import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PrismaModule } from '../../prisma/prisma.module';

/**
 * Dashboard module for admin analytics.
 *
 * Note: ScheduleModule.forRoot() is initialized in AppModule.
 * Exports DashboardService so other modules (like AuctionFinalization)
 * can inject it for triggered refreshes.
 */
@Module({
  imports: [PrismaModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService], // Export for triggered refresh from AuctionFinalizationService
})
export class DashboardModule {}
