import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AuctionModule } from '../auctions/auction.module';
import { ContractModule } from '../contracts/contract.module';
import { PaymentModule } from '../payment/payment.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
@Module({
  imports: [PrismaModule, AuthModule, AuctionModule, ContractModule, PaymentModule, CloudinaryModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
