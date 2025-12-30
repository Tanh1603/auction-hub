import { Module, forwardRef } from '@nestjs/common';
import { RegisterToBidService } from './register-to-bid.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { PaymentModule } from '../../../payment/payment.module';
import { EmailModule } from '../../../common/email/email.module';
import { CloudinaryModule } from '../../../cloudinary/cloudinary.module';
import {
  UserRegistrationService,
  AdminApprovalService,
  RegistrationPaymentService,
  RefundService,
  AutoRefundService,
} from './services';
import {
  UserRegistrationController,
  AdminApprovalController,
  RegistrationPaymentController,
  RefundController,
} from './controllers';
import { RegisterToBidController } from './register-to-bid.controller';

// Note: ScheduleModule.forRoot() is initialized in AppModule
@Module({
  imports: [
    PrismaModule,
    forwardRef(() => PaymentModule),
    EmailModule,
    CloudinaryModule,
  ],
  controllers: [
    RegisterToBidController,
    UserRegistrationController,
    AdminApprovalController,
    RegistrationPaymentController,
    RefundController,
  ],
  providers: [
    RegisterToBidService,
    UserRegistrationService,
    AdminApprovalService,
    RegistrationPaymentService,
    RefundService,
    AutoRefundService,
  ],
  exports: [
    RegisterToBidService,
    RegistrationPaymentService,
    RefundService,
    AutoRefundService,
  ],
})
export class RegisterToBidModule {}
