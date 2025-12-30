import { Module, forwardRef } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentProcessingService } from './payment-processing.service';
import { PaymentController } from './payment.controller';
import { PaymentWebhookController } from './payment.webhook.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RegisterToBidModule } from '../feature/bidding/register-to-bid/register-to-bid.module';

@Module({
  imports: [
    PrismaModule,
    // Use forwardRef to break circular dependency
    // RegisterToBidModule imports PaymentModule for PaymentService
    // PaymentModule imports RegisterToBidModule for RegistrationPaymentService (webhook)
    forwardRef(() => RegisterToBidModule),
  ],
  providers: [PaymentService, PaymentProcessingService],
  controllers: [PaymentController, PaymentWebhookController],
  exports: [PaymentService, PaymentProcessingService],
})
export class PaymentModule {}
