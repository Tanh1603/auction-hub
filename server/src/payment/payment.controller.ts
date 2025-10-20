import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { Payment } from './dto/Payment.dto';
import { PaymentCreateRequestDto } from './dto/PaymentCreateRequest.dto';
import { PaymentVerificationDto } from './dto/PaymentVerification.dto';

@Controller('payments')
export class PaymentController {
    constructor(private paymentService: PaymentService) {}

    @Post('')
    async createPayment(@Body() paymentRequest: PaymentCreateRequestDto): Promise<Payment> {
        return this.paymentService.createPayment(paymentRequest);
    }


    @Get('verify')
    async verifyPayment(@Query('session_id') sessionId: string): Promise<PaymentVerificationDto> {
        return this.paymentService.verifyPayment(sessionId);
    }
}
