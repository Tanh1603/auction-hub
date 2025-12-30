import {
  Controller,
  Post,
  Headers,
  Req,
  RawBodyRequest,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentProcessingService } from './payment-processing.service';
import { RegistrationPaymentService } from '../feature/bidding/register-to-bid/services/registration-payment.service';
import { Request } from 'express';

/**
 * Stripe Webhook Controller
 *
 * Handles automated payment verification for both payment phases:
 * 1. DEPOSIT PAYMENT - During auction registration (Tier 2 approval)
 * 2. WINNING PAYMENT - After auction finalization
 *
 * This eliminates the need for frontend to manually call verify endpoints.
 * Stripe sends webhook events here automatically when payments complete.
 *
 * Flow:
 * - User completes Stripe Checkout
 * - Stripe sends POST /api/payments/webhook/stripe
 * - We verify signature and process payment based on paymentType in metadata
 * - Database is updated accordingly (registration or contract)
 */
@Controller('payments/webhook')
export class PaymentWebhookController {
  private readonly logger = new Logger(PaymentWebhookController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly paymentProcessingService: PaymentProcessingService,
    private readonly registrationPaymentService: RegistrationPaymentService
  ) {}

  @Post('stripe')
  async handleStripeWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() request: RawBodyRequest<Request>
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    // Access raw body from NestJS (enabled via rawBody: true in main.ts)
    const payload = request.rawBody;

    if (!payload) {
      this.logger.error(
        'Raw body not available - check main.ts rawBody config'
      );
      throw new BadRequestException(
        'Raw body not available for webhook verification'
      );
    }

    let event;

    try {
      event = this.paymentService.constructEvent(payload, signature);
    } catch (err) {
      this.logger.error(
        `Webhook signature verification failed: ${err.message}`
      );
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    this.logger.log(`Received Stripe Webhook Event: ${event.type}`);

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const metadata = session.metadata;

      if (!metadata || !metadata.paymentType) {
        this.logger.debug(
          'Ignoring checkout session - missing paymentType in metadata'
        );
        return { received: true };
      }

      const { paymentType, auctionId, registrationId, userId } = metadata;

      this.logger.log(
        `Processing ${paymentType} webhook | Session: ${
          session.id
        } | Auction: ${auctionId || 'N/A'} | Registration: ${
          registrationId || 'N/A'
        }`
      );

      try {
        switch (paymentType) {
          case 'deposit':
            // PHASE 1: Deposit payment during registration
            if (!registrationId) {
              this.logger.error(
                'Deposit payment webhook missing registrationId in metadata'
              );
              break;
            }
            await this.registrationPaymentService.verifyDepositPayment(
              session.id,
              registrationId,
              userId
            );
            this.logger.log(
              `Successfully processed DEPOSIT payment via webhook for session ${session.id}`
            );
            break;

          case 'winning_payment':
            // PHASE 2: Winner payment after auction finalization
            if (!auctionId) {
              this.logger.error(
                'Winning payment webhook missing auctionId in metadata'
              );
              break;
            }
            await this.paymentProcessingService.verifyWinnerPaymentBySessionId(
              session.id,
              auctionId
            );
            this.logger.log(
              `Successfully processed WINNING PAYMENT via webhook for session ${session.id}`
            );
            break;

          default:
            this.logger.debug(`Ignoring payment type: ${paymentType}`);
        }
      } catch (error) {
        // Log error but return 200 OK to Stripe to prevent endless retries
        // for non-retryable errors (e.g., payment already processed, registration not found)
        this.logger.error(
          `Failed to process ${paymentType} payment via webhook: ${error.message}`,
          error.stack
        );
        // Note: For truly retryable errors (DB connection issues), we could throw 500
        // to let Stripe retry. For now, we accept all to avoid duplicate processing issues.
      }
    }

    // Handle payment_intent.payment_failed for failure notifications
    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object;
      const metadata = paymentIntent.metadata;

      if (metadata) {
        this.logger.warn(
          `Payment failed for ${metadata.paymentType || 'unknown'} | ` +
            `Auction: ${metadata.auctionId || 'N/A'} | ` +
            `Reason: ${paymentIntent.last_payment_error?.message || 'Unknown'}`
        );
        // Future: Send failure notification email to user
      }
    }

    return { received: true };
  }
}
