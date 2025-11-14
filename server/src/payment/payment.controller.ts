import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { Payment } from './dto/Payment.dto';
import { PaymentCreateRequestDto } from './dto/PaymentCreateRequest.dto';
import { PaymentVerificationDto } from './dto/PaymentVerification.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('payments')
@UseGuards(AuthGuard)
export class PaymentController {
    constructor(private paymentService: PaymentService) {}

    @Post('')
    async createPayment(
        @CurrentUser() user: CurrentUserData,
        @Body() paymentRequest: PaymentCreateRequestDto
    ): Promise<Payment> {
        return this.paymentService.createPayment(user.id, paymentRequest);
    }


    @Get('verify')
    async verifyPayment(@Query('session_id') sessionId: string): Promise<PaymentVerificationDto> {
        return this.paymentService.verifyPayment(sessionId);
    }
}
