import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PaymentModule } from '../payment/payment.module';
import { AuctionModule } from '../auctions/auction.module';
import { BiddingModule } from '../feature/bidding/bidding.module';
import { CommonModule } from '../common/common.module';
import { AuctionFinalizationModule } from '../feature/auction-finalization/auction-finalization.module';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuctionPolicyModule } from '../feature/auction-policy/auction-policy.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { ArticleModule } from '../article/article.module';
import { LocationModule } from '../location/location.module';

import { ContractModule } from '../contracts/contract.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    CommonModule,
    PrismaModule,
    AuthModule,
    PaymentModule,
    AuctionModule,
    BiddingModule,
    AuctionFinalizationModule,
    AuctionPolicyModule,
    CloudinaryModule, ArticleModule, LocationModule,
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
