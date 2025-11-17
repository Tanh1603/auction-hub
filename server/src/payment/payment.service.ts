import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentCreateRequestDto } from './dto/PaymentCreateRequest.dto';
import { Payment } from './dto/Payment.dto';
import { PaymentVerificationDto } from './dto/PaymentVerification.dto';
import { PaymentStatus } from '../../generated';
import Stripe from 'stripe';
import * as QRCode from 'qrcode';

@Injectable()
export class PaymentService {
  private stripe: Stripe;

  constructor(private prisma: PrismaService) {
    const stripeSecretKey =
      process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-10-29.clover',
    });
  }

  async createPayment(
    userId: string,
    paymentRequest: PaymentCreateRequestDto
  ): Promise<Payment> {
    try {
      // TODO: Validate registration and auction id with database
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'vnd',
              product_data: {
                name: `${paymentRequest.paymentType.replace(
                  '_',
                  ' '
                )} - Auction Payment`,
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
          userId: userId,
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

      const bankInfo = {
        bank_name: 'Stripe',
        account_number: 'Stripe',
        account_name: 'Auction Hub',
        transfer_content: `Payment for ${paymentRequest.paymentType}`,
      };

      // Map Stripe payment status to our PaymentStatus enum
      const statusMapping: Record<string, PaymentStatus> = {
        unpaid: PaymentStatus.pending,
        paid: PaymentStatus.completed,
        no_payment_required: PaymentStatus.completed,
      };
      const paymentStatus =
        statusMapping[session.payment_status] || PaymentStatus.pending;

      await this.prisma.payment.create({
        data: {
          userId: userId,
          auctionId: paymentRequest.auctionId,
          registrationId: paymentRequest.registrationId,
          paymentType: paymentRequest.paymentType,
          amount: paymentRequest.amount,
          currency: 'USD',
          status: paymentStatus,
          paymentMethod: paymentRequest.paymentMethod,
          transactionId: session.id,
          paymentDetails: {
            payment_url: session.url,
            qr_code: qrCodeDataUrl,
            bank_info: bankInfo,
            payment_deadline: paymentDeadline.toISOString(),
            stripe_session_id: session.id,
          },
        },
      });

      const payment: Payment = {
        payment_id: session.id,
        amount: paymentRequest.amount,
        currency: 'USD',
        status: session.payment_status || 'unpaid',
        payment_url: session.url,
        qr_code: qrCodeDataUrl,
        bank_info: bankInfo,
        payment_deadline: paymentDeadline.toISOString(),
      };

      return payment;
    } catch (error) {
      console.error('Error creating Stripe payment:', error);
      throw new BadRequestException(
        `Failed to create payment: ${error.message}`
      );
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
      throw new BadRequestException(
        `Failed to verify payment: ${error.message}`
      );
    }
  }
}
