
import { Module } from '@nestjs/common';
import { RegisterToBidService } from './register-to-bid.service';
import { RegisterToBidController } from './register-to-bid.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { PaymentModule } from '../../../payment/payment.module';

@Module({
  imports: [PrismaModule, PaymentModule],
  controllers: [RegisterToBidController],
  providers: [RegisterToBidService],
  exports: [RegisterToBidService],
})
export class RegisterToBidModule {}
