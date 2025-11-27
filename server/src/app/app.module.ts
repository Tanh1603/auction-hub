import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PaymentModule } from '../payment/payment.module';
import { AuctionModule } from '../auctions/auction.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { ArticleModule } from '../article/article.module';

@Module({
  imports: [PrismaModule, AuthModule, PaymentModule, AuctionModule, CloudinaryModule, ArticleModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
