import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AuctionModule } from '../auctions/auction.module';
import { BiddingModule } from '../feature/bidding/bidding.module';
import { CommonModule } from '../common/common.module';
import { AuctionFinalizationModule } from '../feature/auction-finalization/auction-finalization.module';

@Module({
  imports: [
    CommonModule,
    PrismaModule,
    AuthModule,
    AuctionModule,
    BiddingModule,
    AuctionFinalizationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
