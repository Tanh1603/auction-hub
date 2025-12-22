/**
 * Email Processor - Handles email jobs from the queue
 * Uses BullMQ @Processor decorator to consume jobs from EMAIL_QUEUE
 */
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EMAIL_QUEUE, EmailJob, EmailJobData } from './email.queue';
import {
  EmailService,
  DocumentsVerifiedEmailData,
  FinalApprovalEmailData,
  DepositPaymentEmailData,
  DepositConfirmedEmailData,
  AdminDepositNotificationEmailData,
  WinnerPaymentRequestEmailData,
  WinnerPaymentConfirmedEmailData,
  SellerPaymentNotificationEmailData,
  AdminWinnerPaymentNotificationEmailData,
  AuctionResultEmailData,
  PaymentFailureEmailData,
  PaymentDeadlineReminderEmailData,
  AdminRefundRequestedEmailData,
  RefundApprovedEmailData,
  RefundRejectedEmailData,
  RefundProcessedEmailData,
  UserRefundRequestedEmailData,
} from '../services/email.service';

@Processor(EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly emailService: EmailService) {
    super();
    this.logger.log('Email processor initialized');
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    const { jobType, recipientEmail, payload } = job.data;

    this.logger.log(
      `Processing email job ${job.id}: ${jobType} to ${recipientEmail}`
    );

    try {
      switch (jobType) {
        // Registration & Document flow
        case EmailJob.DOCUMENTS_VERIFIED:
          await this.emailService.sendDocumentsVerifiedEmail(
            payload as unknown as DocumentsVerifiedEmailData
          );
          break;

        case EmailJob.FINAL_APPROVAL:
          await this.emailService.sendFinalApprovalEmail(
            payload as unknown as FinalApprovalEmailData
          );
          break;

        // Deposit flow
        case EmailJob.DEPOSIT_PAYMENT_REQUEST:
          await this.emailService.sendDepositPaymentRequestEmail(
            payload as unknown as DepositPaymentEmailData
          );
          break;

        case EmailJob.DEPOSIT_CONFIRMED:
          await this.emailService.sendDepositConfirmedEmail(
            payload as unknown as DepositConfirmedEmailData
          );
          break;

        case EmailJob.ADMIN_DEPOSIT_NOTIFICATION:
          await this.emailService.sendAdminDepositNotificationEmail(
            payload as unknown as AdminDepositNotificationEmailData
          );
          break;

        // Winner payment flow
        case EmailJob.WINNER_PAYMENT_REQUEST:
          await this.emailService.sendWinnerPaymentRequestEmail(
            payload as unknown as WinnerPaymentRequestEmailData
          );
          break;

        case EmailJob.WINNER_PAYMENT_CONFIRMED:
          await this.emailService.sendWinnerPaymentConfirmedEmail(
            payload as unknown as WinnerPaymentConfirmedEmailData
          );
          break;

        case EmailJob.SELLER_PAYMENT_NOTIFICATION:
          await this.emailService.sendSellerPaymentNotificationEmail(
            payload as unknown as SellerPaymentNotificationEmailData
          );
          break;

        case EmailJob.ADMIN_WINNER_PAYMENT_NOTIFICATION:
          await this.emailService.sendAdminWinnerPaymentNotificationEmail(
            payload as unknown as AdminWinnerPaymentNotificationEmailData
          );
          break;

        // Auction results
        case EmailJob.AUCTION_RESULT:
          await this.emailService.sendAuctionResultEmail(
            payload as unknown as AuctionResultEmailData
          );
          break;

        // Payment failures & reminders
        case EmailJob.PAYMENT_FAILURE:
          await this.emailService.sendPaymentFailureEmail(
            payload as unknown as PaymentFailureEmailData
          );
          break;

        case EmailJob.PAYMENT_DEADLINE_REMINDER:
          await this.emailService.sendPaymentDeadlineReminderEmail(
            payload as unknown as PaymentDeadlineReminderEmailData
          );
          break;

        // Refund flow
        case EmailJob.ADMIN_REFUND_REQUESTED:
          await this.emailService.sendAdminRefundRequestedEmail(
            payload as unknown as AdminRefundRequestedEmailData
          );
          break;

        case EmailJob.USER_REFUND_REQUESTED:
          await this.emailService.sendUserRefundRequestedEmail(
            payload as unknown as UserRefundRequestedEmailData
          );
          break;

        case EmailJob.REFUND_APPROVED:
          await this.emailService.sendRefundApprovedEmail(
            payload as unknown as RefundApprovedEmailData
          );
          break;

        case EmailJob.REFUND_REJECTED:
          await this.emailService.sendRefundRejectedEmail(
            payload as unknown as RefundRejectedEmailData
          );
          break;

        case EmailJob.REFUND_PROCESSED:
          await this.emailService.sendRefundProcessedEmail(
            payload as unknown as RefundProcessedEmailData
          );
          break;

        default:
          this.logger.warn(`Unknown email job type: ${jobType}`);
      }

      this.logger.log(
        `Email job ${job.id} completed: ${jobType} to ${recipientEmail}`
      );
    } catch (error) {
      this.logger.error(
        `Email job ${job.id} failed: ${jobType} to ${recipientEmail}`,
        error instanceof Error ? error.stack : error
      );
      throw error; // Re-throw to trigger BullMQ retry mechanism
    }
  }
}
