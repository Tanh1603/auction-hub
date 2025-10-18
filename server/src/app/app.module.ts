import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { BiddingModule } from '../feature/bidding/bidding.module';

@Module({
  imports: [PrismaModule, AuthModule, BiddingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
