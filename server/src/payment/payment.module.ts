import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentProcessingService } from './payment-processing.service';
import { PaymentController } from './payment.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [
    PaymentService,
    PaymentProcessingService,
  ],
  controllers: [PaymentController],
  exports: [PaymentService, PaymentProcessingService],
})
export class PaymentModule {}
