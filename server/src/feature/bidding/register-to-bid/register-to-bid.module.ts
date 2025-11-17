import { Module } from '@nestjs/common';
import { RegisterToBidService } from './register-to-bid.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { PaymentModule } from '../../../payment/payment.module';
import { EmailModule } from '../../../common/email/email.module';
import {
  UserRegistrationService,
  AdminApprovalService,
  RegistrationPaymentService,
} from './services';
import {
  UserRegistrationController,
  AdminApprovalController,
  RegistrationPaymentController,
} from './controllers';

@Module({
  imports: [PrismaModule, PaymentModule, EmailModule],
  controllers: [
    UserRegistrationController,
    AdminApprovalController,
    RegistrationPaymentController,
  ],
  providers: [
    RegisterToBidService,
    UserRegistrationService,
    AdminApprovalService,
    RegistrationPaymentService,
  ],
  exports: [RegisterToBidService],
})
export class RegisterToBidModule {}
