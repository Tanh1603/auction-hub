import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentCreateRequestDto } from './dto/PaymentCreateRequest.dto';
import { Payment } from './dto/Payment.dto';
import { PaymentMethodsResponseDto } from './dto/PaymentMethod.dto';
import { PaymentVerificationDto } from './dto/PaymentVerification.dto';
import Stripe from 'stripe';
import * as QRCode from 'qrcode';

@Injectable()
export class PaymentService {
    private stripe: Stripe;

    constructor(private prisma: PrismaService) {
        const stripeSecretKey = process.env.STRIPE_SECRET_KEY ;
        this.stripe = new Stripe(stripeSecretKey, {
            apiVersion: '2025-09-30.clover',
        });
    }

    async createPayment(paymentRequest: PaymentCreateRequestDto): Promise<Payment> {
        try {
            // TODO: Validate registration and auction id with database
            const session = await this.stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [
                    {
                        price_data: {
                            currency: 'usd',
                            product_data: {
                                name: `${paymentRequest.paymentType.replace('_', ' ')} - Auction Payment`,
                                description: `Payment for auction ${paymentRequest.auctionId}`,
                            },
                            unit_amount: Math.round(paymentRequest.amount * 100),
                        },
                        quantity: 1,
                    },
                ],
                mode: 'payment',
                success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
                metadata: {
                    auctionId: paymentRequest.auctionId,
                    registrationId: paymentRequest.registrationId,
                    paymentType: paymentRequest.paymentType,
                },
            });

            const qrCodeDataUrl = await QRCode.toDataURL(session.url, {
                errorCorrectionLevel: 'H',
                type: 'image/png',
                width: 300,
                margin: 2,
            });

            const paymentDeadline = new Date();
            paymentDeadline.setHours(paymentDeadline.getHours() + 24);

            const payment: Payment = {
                payment_id: session.id,
                amount: paymentRequest.amount,
                currency: 'USD',
                status: session.payment_status || 'unpaid',
                payment_url: session.url,
                qr_code: qrCodeDataUrl,
                bank_info: {
                    bank_name: 'Stripe',
                    account_number: 'Stripe',
                    account_name: 'Auction Hub',
                    transfer_content: `Payment for ${paymentRequest.paymentType}`,
                },
                payment_deadline: paymentDeadline.toISOString(),
            };

            // TODO: Save to db
            // await this.prisma.payment.create({ data: { ... } });

            return payment;
        } catch (error) {
            console.error('Error creating Stripe payment:', error);
            throw new BadRequestException(`Failed to create payment: ${error.message}`);
        }
    }

    async verifyPayment(sessionId: string): Promise<PaymentVerificationDto> {
        try {
            const session = await this.stripe.checkout.sessions.retrieve(sessionId);
            return {
                payment_id: session.id,
                status: session.payment_status,
                amount: session.amount_total / 100,
                currency: session.currency.toUpperCase(),
                metadata: session.metadata,
            };
        } catch (error) {
            console.error('Error verifying payment:', error);
            throw new BadRequestException(`Failed to verify payment: ${error.message}`);
        }
    }
}
