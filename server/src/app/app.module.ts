import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
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
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: 'server/.env',
    }),
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
