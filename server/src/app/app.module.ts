import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { ArticleModule } from '../article/article.module';
import { AuctionModule } from '../auctions/auction.module';
import { AuthModule } from '../auth/auth.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { CommonModule } from '../common/common.module';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuctionFinalizationModule } from '../feature/auction-finalization/auction-finalization.module';
import { AuctionPolicyModule } from '../feature/auction-policy/auction-policy.module';
import { BiddingModule } from '../feature/bidding/bidding.module';
import { LocationModule } from '../location/location.module';
import { PaymentModule } from '../payment/payment.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { QueueModule } from '../common/queue/queue.module';
import { ContractModule } from '../contracts/contract.module';
import { DashboardModule } from '../feature/dashboard/dashboard.module';

// Load .env as early as possible before ConfigModule initializes
// This works regardless of current working directory
dotenv.config({ path: path.resolve(__dirname, '../..', '.env') });

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // In test mode, env vars are already loaded by jest.setup.ts
      // In production, we need to load from .env file
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      // Fallback to loading from .env when not in test mode
      envFilePath:
        process.env.NODE_ENV === 'test'
          ? undefined
          : path.resolve(__dirname, '../..', '.env'),
    }),
    ScheduleModule.forRoot(), // Initialize scheduling globally (enables @Cron decorators)
    CommonModule,
    PrismaModule,
    AuthModule,
    PaymentModule,
    AuctionModule,
    BiddingModule,
    AuctionFinalizationModule,
    AuctionPolicyModule,
    CloudinaryModule,
    ArticleModule,
    LocationModule,
    ContractModule,
    QueueModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
