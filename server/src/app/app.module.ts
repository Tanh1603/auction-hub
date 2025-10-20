import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AuctionModule } from '../auctions/auction.module';
import { ContractModule } from '../contracts/contract.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [PrismaModule, AuthModule, AuctionModule, ContractModule, PaymentModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
