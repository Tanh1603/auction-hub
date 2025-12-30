import { Module } from '@nestjs/common';
import { AuctionController } from './auction.controller';
import { AuctionService } from './auction.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { AUCTION_QUEUE } from './auction.queue';
import { AuctionProcessor } from './auction.processor';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    PrismaModule,
    CloudinaryModule,
    BullModule.registerQueue({
      name: AUCTION_QUEUE,
    }),
  ],
  controllers: [AuctionController],
  providers: [AuctionService, AuctionProcessor],
  exports: [],
})
export class AuctionModule {}
