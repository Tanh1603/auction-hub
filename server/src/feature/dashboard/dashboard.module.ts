import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PrismaModule } from '../../prisma/prisma.module';

/**
 * Dashboard module for admin analytics.
 *
 * Imports ScheduleModule for cron-based view refresh.
 * Exports DashboardService so other modules (like AuctionFinalization)
 * can inject it for triggered refreshes.
 */
@Module({
  imports: [
    PrismaModule,
    ScheduleModule.forRoot(), // Enables @Cron decorators
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService], // Export for triggered refresh from AuctionFinalizationService
})
export class DashboardModule {}
