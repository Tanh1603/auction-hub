// Payment-focused registration service
// Handles: deposit payment initiation, verification, payment status tracking
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { PaymentService } from '../../../../payment/payment.service';
import { PaymentProcessingService } from '../../../../payment/payment-processing.service';
import { EmailService } from '../../../../common/services/email.service';
import type { AuctionParticipant } from '../../../../../generated';
import {
  PaymentType,
  PaymentMethod,
} from '../../../../payment/dto/PaymentCreateRequest.dto';

@Injectable()
export class RegistrationPaymentService {
  private readonly logger = new Logger(RegistrationPaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
    private readonly paymentProcessingService: PaymentProcessingService,
    private readonly emailService: EmailService
  ) {}

  /**
   * TWO-TIER APPROVAL: Tier 2 - Submit Deposit
   * User initiates deposit payment after documents are verified
   * Creates Stripe payment and returns payment URL/QR code
   */
  async submitDeposit(
    registrationId: string,
    auctionId: string,
    amount: number,
    userId: string
  ) {
    try {
      // Validate registration exists and is in correct state
      const participant = await this.prisma.auctionParticipant.findUnique({
        where: { id: registrationId },
        include: {
          user: true,
          auction: true,
        },
      });

      if (!participant) {
        throw new NotFoundException('Registration not found');
      }

      if (participant.userId !== userId) {
        throw new BadRequestException('Registration does not belong to user');
      }

      if (!participant.documentsVerifiedAt) {
        throw new BadRequestException(
          'Documents must be verified before submitting deposit'
        );
      }

      if (participant.depositPaidAt) {
        throw new ConflictException('Deposit already submitted');
      }

      if (participant.withdrawnAt) {
        throw new BadRequestException(
          'Cannot submit deposit for withdrawn registration'
        );
      }

      // Use PaymentProcessingService to create payment and handle business logic
      const paymentResult =
        await this.paymentProcessingService.processDepositPayment(
          userId,
          auctionId,
          registrationId,
          amount
        );

      this.logger.log(
        `Deposit payment initiated for registration ${registrationId}. Payment ID: ${paymentResult.paymentId}`
      );

      return paymentResult;
    } catch (err) {
      this.logger.error(
        `Failed to submit deposit for registration ${registrationId}`,
        (err as Error)?.stack
      );
      throw err;
    }
  }

  /**
   * TWO-TIER APPROVAL: Verify Deposit Payment
   * Verify Stripe payment and update registration with deposit payment details
   */
  async verifyDepositPayment(
    sessionId: string,
    registrationId: string,
    userId: string
  ) {
    try {
      // Verify the registration belongs to the user and get auction info
      const participant = await this.prisma.auctionParticipant.findUnique({
        where: { id: registrationId },
        include: {
          auction: true,
        },
      });

      if (!participant) {
        throw new NotFoundException('Registration not found');
      }

      if (participant.userId !== userId) {
        throw new BadRequestException('Registration does not belong to user');
      }

      if (participant.depositPaidAt) {
        throw new ConflictException('Deposit already verified');
      }

      // Verify payment with Stripe
      const verification = await this.paymentService.verifyPayment(sessionId);

      // ✅ FIX: Enhanced logging for deposit payment verification
      this.logger.log(
        `[DEPOSIT VERIFICATION] Session ${sessionId}: ` +
        `status='${verification.status}', ` +
        `amount=${verification.amount}, ` +
        `currency='${verification.currency}'`
      );

      if (verification.status !== 'paid') {
        this.logger.warn(
          `[DEPOSIT VERIFICATION FAILED] Payment status is '${verification.status}', expected 'paid'`
        );
        throw new BadRequestException(`Payment not completed yet. Current status: ${verification.status}`);
      }

      // CRITICAL: Verify the received amount matches the expected deposit amount
      const expectedAmount = parseFloat(
        participant.auction.depositAmountRequired.toString()
      );
      const receivedAmount = verification.amount;

      this.logger.log(
        `[DEPOSIT AMOUNT CHECK] Expected: ${expectedAmount} VND, Received: ${receivedAmount} ${verification.currency}`
      );

      if (receivedAmount < expectedAmount) {
        // Payment amount is insufficient
        this.logger.error(
          `[DEPOSIT VERIFICATION FAILED] Amount mismatch for ${registrationId}. ` +
          `Expected ${expectedAmount} VND, but received ${receivedAmount} ${verification.currency}`
        );
        throw new BadRequestException(
          `Payment received (${receivedAmount} ${verification.currency}) is less than the required deposit (${expectedAmount} VND). Please contact support.`
        );
      }

      this.logger.log(
        `[DEPOSIT VERIFICATION SUCCESS] Amount verified: ${receivedAmount} ${verification.currency} >= ${expectedAmount} VND`
      );

      // Find the payment record by transaction ID (Stripe session ID)
      const payment = await this.prisma.payment.findFirst({
        where: {
          transactionId: sessionId,
          registrationId: registrationId,
        },
      });

      if (!payment) {
        throw new NotFoundException('Payment record not found');
      }

      // Update both payment and registration in a transaction
      const updatedParticipant = await this.prisma.$transaction(async (tx) => {
        // Update payment status
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'completed',
            paidAt: new Date(),
          },
        });

        // Update registration with deposit info
        const updated = await tx.auctionParticipant.update({
          where: { id: registrationId },
          data: {
            depositPaidAt: new Date(),
            depositAmount: receivedAmount, // Use receivedAmount since it matches expectedAmount
            depositPaymentId: payment.id,
          },
        });

        return updated;
      });

      // LOG: Registration state AFTER payment verification
      this.logger.log(
        `[PAYMENT VERIFICATION SUCCESS] Registration ${registrationId}:` +
        ` documentsVerifiedAt=${updatedParticipant.documentsVerifiedAt?.toISOString() || 'NULL'},` +
        ` depositPaidAt=${updatedParticipant.depositPaidAt?.toISOString() || 'NULL'},` +
        ` documentsVerifiedBy=${updatedParticipant.documentsVerifiedBy || 'NULL'}`
      );

      this.logger.log(
        `Deposit payment verified for registration ${registrationId}. Session ID: ${sessionId}`
      );

      return {
        verified: true,
        paymentId: payment.id,
        sessionId: sessionId,
        amount: verification.amount,
        status: 'completed',
        message:
          'Deposit payment verified successfully. Awaiting final admin approval.',
      };
    } catch (err) {
      this.logger.error(
        `Failed to verify deposit payment for registration ${registrationId}`,
        (err as Error)?.stack
      );
      throw err;
    }
  }

  /**
   * INTEGRATION POINT 1a: Initiate deposit payment (Tier 2 - Step 1)
   * After documents are verified, user initiates deposit payment
   *
   * SIMPLIFIED APPROACH:
   * - Deposit amount already calculated by policy
   * - Directly invoke PaymentService.createPayment()
   */
  async initiateDepositPayment(registrationId: string, userId: string) {
    try {
      this.logger.log(
        `Initiating deposit payment for registration ${registrationId} by user ${userId}`
      );

      // Get registration with auction details
      const participant = await this.prisma.auctionParticipant.findUnique({
        where: { id: registrationId },
        include: {
          auction: true,
        },
      });

      if (!participant) {
        throw new NotFoundException('Registration not found');
      }

      if (participant.userId !== userId) {
        throw new BadRequestException('Registration does not belong to user');
      }

      if (!participant.documentsVerifiedAt) {
        throw new BadRequestException(
          'Documents must be verified before deposit payment'
        );
      }

      if (participant.depositPaidAt) {
        throw new BadRequestException('Deposit already paid');
      }

      // Deposit amount already calculated by policy and stored in auction
      const depositAmount = parseFloat(
        participant.auction.depositAmountRequired.toString()
      );

      // Directly invoke PaymentService.createPayment() - SIMPLIFIED!
      const paymentInfo = await this.paymentService.createPayment(userId, {
        auctionId: participant.auctionId,
        registrationId: registrationId,
        paymentType: PaymentType.deposit,
        amount: depositAmount,
        paymentMethod: PaymentMethod.bank_transfer,
      });

      this.logger.log(
        `Deposit payment created: ${paymentInfo.payment_id} for registration ${registrationId}. Amount: ${depositAmount}`
      );

      return {
        paymentId: paymentInfo.payment_id,
        amount: depositAmount,
        paymentUrl: paymentInfo.payment_url,
        qrCode: paymentInfo.qr_code,
        bankInfo: paymentInfo.bank_info,
        deadline: paymentInfo.payment_deadline,
        message:
          'Please complete payment within 24 hours to proceed with registration.',
      };
    } catch (err) {
      this.logger.error(
        `Failed to initiate deposit payment for registration ${registrationId}`,
        (err as Error)?.stack
      );
      throw err;
    }
  }

  /**
   * INTEGRATION POINT 1b: Verify deposit payment and update registration
   * Called after user completes payment via Stripe
   *
   * SIMPLIFIED APPROACH:
   * - Directly invoke PaymentService.verifyPayment()
   * - Update registration state after verification
   */
  async verifyAndConfirmDepositPayment(
    registrationId: string,
    paymentId: string
  ) {
    try {
      this.logger.log(
        `Verifying deposit payment ${paymentId} for registration ${registrationId}`
      );

      // Step 1: Verify payment with Stripe via PaymentService
      const verification = await this.paymentService.verifyPayment(paymentId);

      if (verification.status !== 'paid') {
        this.logger.warn(
          `Payment ${paymentId} verification failed. Status: ${verification.status}`
        );

        // Get participant with user and auction info for email
        const participant = await this.prisma.auctionParticipant.findUnique({
          where: { id: registrationId },
          include: {
            user: true,
            auction: true,
          },
        });

        if (participant) {
          // Calculate remaining time to deadline (24 hours from documents verified)
          const deadlineDate = new Date(participant.documentsVerifiedAt);
          deadlineDate.setHours(deadlineDate.getHours() + 24);
          const now = new Date();

          // Check if deadline has passed
          if (now > deadlineDate) {
            // Deadline expired - mark registration as needing re-submission
            // IMPORTANT: Do NOT clear documentsVerifiedAt/documentsVerifiedBy
            // The documents were already verified - only the payment deadline expired
            await this.prisma.auctionParticipant.update({
              where: { id: registrationId },
              data: {
                withdrawnAt: new Date(),
                withdrawalReason:
                  'Payment deadline expired. Deposit not received within 24 hours. Please re-register if you still wish to participate.',
              },
            });

            this.logger.error(
              `Registration ${registrationId} automatically withdrawn due to expired payment deadline`
            );

            throw new BadRequestException(
              'Payment deadline has expired. Your registration has been cancelled. Please re-register if you still wish to participate.'
            );
          }

          // Deadline not expired - send failure notification email
          const depositAmount = parseFloat(
            participant.auction.depositAmountRequired.toString()
          );

          // Send payment failure email to user
          await this.emailService.sendPaymentFailureEmail({
            recipientEmail: participant.user.email,
            recipientName: participant.user.fullName,
            auctionCode: participant.auction.code,
            auctionName: participant.auction.name,
            paymentType: 'deposit',
            attemptedAmount: depositAmount.toString(), // Don't format here - let email template handle it
            failureReason: this.getPaymentFailureReason(verification.status),
            retryUrl: `${process.env.FRONTEND_URL}/auctions/${participant.auctionId}/payment/retry?paymentId=${paymentId}`,
            deadline: deadlineDate,
          });

          // Track payment attempt
          await this.prisma.payment.update({
            where: { id: paymentId },
            data: {
              status: 'failed',
            },
          });
        }

        throw new BadRequestException(
          `Payment not completed. Status: ${verification.status}. Please retry payment before the deadline.`
        );
      }

      // Step 2: Update payment record in database
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'completed',
          paidAt: new Date(),
        },
      });

      // Step 3: Update registration with deposit payment info
      const updated = await this.prisma.auctionParticipant.update({
        where: { id: registrationId },
        data: {
          depositPaidAt: new Date(),
          depositAmount: verification.amount,
          depositPaymentId: paymentId,
        },
        include: {
          auction: true,
          user: true,
        },
      });

      this.logger.log(
        `Deposit payment ${paymentId} verified and confirmed for registration ${registrationId}. Ready for Tier 2 approval.`
      );

      // Send email notification to user
      await this.emailService.sendDepositConfirmedEmail({
        recipientEmail: updated.user.email,
        recipientName: updated.user.fullName,
        auctionCode: updated.auction.code,
        auctionName: updated.auction.name,
        depositAmount: verification.amount.toString(), // Don't format here - let email template handle it
        paidAt: new Date(),
        awaitingApproval: true,
      });

      // Send notification to admin(s)
      const adminUsers = await this.prisma.user.findMany({
        where: {
          role: { in: ['admin', 'auctioneer'] },
          isBanned: false,
          deletedAt: null,
        },
      });

      // Send notification to each admin
      const adminNotificationPromises = adminUsers.map((admin) =>
        this.emailService.sendAdminDepositNotificationEmail({
          recipientEmail: admin.email,
          adminName: admin.fullName,
          userName: updated.user.fullName,
          userEmail: updated.user.email,
          auctionCode: updated.auction.code,
          auctionName: updated.auction.name,
          depositAmount: verification.amount.toString(), // Don't format here - let email template handle it
          paidAt: new Date(),
          registrationId: registrationId,
        })
      );

      // Send emails asynchronously (don't wait for completion)
      Promise.allSettled(adminNotificationPromises).catch((err) => {
        this.logger.error('Error sending admin deposit notifications:', err);
      });

      this.logger.log(
        `Email notifications sent for deposit payment ${paymentId}: user notified, ${adminUsers.length} admin(s) notified`
      );

      return {
        success: true,
        paymentVerified: true,
        depositPaid: true,
        registration: this.toDto(updated),
        message:
          'Deposit payment confirmed. Awaiting final approval from auctioneer.',
        nextStep:
          'Admin will review and give final approval. You will be notified via email.',
      };
    } catch (err) {
      this.logger.error(
        `Failed to verify deposit payment ${paymentId} for registration ${registrationId}`,
        (err as Error)?.stack
      );
      throw err;
    }
  }

  /**
   * Helper method to get user-friendly payment failure reason
   */
  private getPaymentFailureReason(status: string): string {
    const reasonMap: Record<string, string> = {
      failed:
        'Payment processing failed. Please check your payment method and try again.',
      cancelled:
        'Payment was cancelled. Please retry to complete your registration.',
      expired: 'Payment session expired. Please initiate a new payment.',
      pending:
        'Payment is still pending. Please wait a few minutes and try verification again.',
      processing:
        'Payment is being processed. Please wait a few minutes before verifying.',
    };

    return (
      reasonMap[status] ||
      'Payment could not be completed. Please try again or contact support.'
    );
  }

  /**
   * Get current state of registration based on timestamps
   * This helper derives state from the temporal model
   * Updated to support two-tier approval
   */
  private getCurrentState(participant: AuctionParticipant): string {
    if (participant.checkedInAt) return 'CHECKED_IN';
    if (participant.withdrawnAt) return 'WITHDRAWN';
    if (participant.confirmedAt) return 'CONFIRMED';
    if (participant.depositPaidAt) return 'DEPOSIT_PAID';
    if (participant.documentsVerifiedAt && !participant.depositPaidAt)
      return 'DOCUMENTS_VERIFIED';
    if (participant.documentsRejectedAt) return 'DOCUMENTS_REJECTED';
    if (participant.rejectedAt) return 'REJECTED';
    if (participant.submittedAt) return 'PENDING_DOCUMENT_REVIEW';
    if (participant.registeredAt) return 'REGISTERED';
    return 'UNKNOWN';
  }

  /**
   * Convert database record to DTO
   * Include derived state for convenience
   * Updated to include two-tier approval fields
   */
  private toDto = (p: AuctionParticipant) => ({
    id: p.id,
    userId: p.userId,
    auctionId: p.auctionId,

    // Registration timestamps
    registeredAt: p.registeredAt,
    submittedAt: p.submittedAt,

    // Two-tier approval: Tier 1 - Document verification
    documentsVerifiedAt: p.documentsVerifiedAt,
    documentsVerifiedBy: p.documentsVerifiedBy,
    documentsRejectedAt: p.documentsRejectedAt,
    documentsRejectedReason: p.documentsRejectedReason,
    documentUrls: p.documentUrls ? JSON.parse(p.documentUrls as string) : null,

    // Two-tier approval: Tier 2 - Deposit verification
    depositPaidAt: p.depositPaidAt,
    depositAmount: p.depositAmount
      ? parseFloat(p.depositAmount.toString())
      : null,
    depositPaymentId: p.depositPaymentId,

    // Final approval
    confirmedAt: p.confirmedAt,
    confirmedBy: p.confirmedBy,

    // Legacy rejection
    rejectedAt: p.rejectedAt,
    rejectedReason: p.rejectedReason,

    // Other states
    checkedInAt: p.checkedInAt,
    withdrawnAt: p.withdrawnAt,
    withdrawalReason: p.withdrawalReason,

    // Derived state
    currentState: this.getCurrentState(p),
  });
}
