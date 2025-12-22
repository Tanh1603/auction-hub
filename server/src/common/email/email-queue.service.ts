/**
 * Email Queue Service
 * Simple service to add email jobs to the background queue
 * Use this instead of directly calling EmailService methods for non-blocking email sending
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EMAIL_QUEUE, EmailJob, EmailJobData } from './email.queue';

@Injectable()
export class EmailQueueService {
  private readonly logger = new Logger(EmailQueueService.name);

  constructor(@InjectQueue(EMAIL_QUEUE) private emailQueue: Queue) {
    this.logger.log('Email queue service initialized');
  }

  /**
   * Add a generic email job to the queue
   */
  private async addJob(
    jobType: EmailJob,
    recipientEmail: string,
    recipientName: string | undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: Record<string, any>
  ): Promise<string> {
    const jobData: EmailJobData = {
      jobType,
      recipientEmail,
      recipientName,
      payload,
    };

    const job = await this.emailQueue.add(jobType, jobData, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000, // 2s, then 4s, then 8s
      },
      removeOnComplete: true,
      removeOnFail: false, // Keep failed jobs for debugging
    });

    this.logger.debug(
      `Email job ${job.id} added to queue: ${jobType} to ${recipientEmail}`
    );

    return job.id as string;
  }

  // ============ Registration & Document Flow ============

  /**
   * Queue documents verified email
   */
  async queueDocumentsVerifiedEmail(data: {
    recipientEmail: string;
    recipientName: string;
    auctionCode: string;
    auctionName: string;
    nextStep: 'pay_deposit' | 'awaiting_approval';
    depositAmount?: string;
    paymentDeadline?: Date;
  }): Promise<string> {
    return this.addJob(
      EmailJob.DOCUMENTS_VERIFIED,
      data.recipientEmail,
      data.recipientName,
      data
    );
  }

  /**
   * Queue final approval email
   */
  async queueFinalApprovalEmail(data: {
    recipientEmail: string;
    recipientName: string;
    auctionCode: string;
    auctionName: string;
    auctionStartAt: Date;
    canNowBid: boolean;
  }): Promise<string> {
    return this.addJob(
      EmailJob.FINAL_APPROVAL,
      data.recipientEmail,
      data.recipientName,
      data
    );
  }

  // ============ Deposit Flow ============

  /**
   * Queue deposit payment request email
   */
  async queueDepositPaymentRequestEmail(data: {
    recipientEmail: string;
    recipientName: string;
    auctionCode: string;
    auctionName: string;
    depositAmount: string;
    paymentUrl: string;
    qrCode?: string;
    deadline: Date;
  }): Promise<string> {
    return this.addJob(
      EmailJob.DEPOSIT_PAYMENT_REQUEST,
      data.recipientEmail,
      data.recipientName,
      data
    );
  }

  /**
   * Queue deposit confirmed email to user
   */
  async queueDepositConfirmedEmail(data: {
    recipientEmail: string;
    recipientName: string;
    auctionCode: string;
    auctionName: string;
    depositAmount: string;
    paidAt: Date;
    awaitingApproval: boolean;
  }): Promise<string> {
    return this.addJob(
      EmailJob.DEPOSIT_CONFIRMED,
      data.recipientEmail,
      data.recipientName,
      data
    );
  }

  /**
   * Queue admin deposit notification email
   */
  async queueAdminDepositNotificationEmail(data: {
    recipientEmail: string;
    adminName: string;
    userName: string;
    userEmail: string;
    auctionCode: string;
    auctionName: string;
    depositAmount: string;
    paidAt: Date;
    registrationId: string;
  }): Promise<string> {
    return this.addJob(
      EmailJob.ADMIN_DEPOSIT_NOTIFICATION,
      data.recipientEmail,
      data.adminName,
      data
    );
  }

  // ============ Winner Payment Flow ============

  /**
   * Queue winner payment request email
   */
  async queueWinnerPaymentRequestEmail(data: {
    recipientEmail: string;
    recipientName: string;
    auctionCode: string;
    auctionName: string;
    winningAmount: string;
    depositAlreadyPaid: string;
    dossierFee: string;
    totalDue: string;
    paymentDeadline: Date;
  }): Promise<string> {
    return this.addJob(
      EmailJob.WINNER_PAYMENT_REQUEST,
      data.recipientEmail,
      data.recipientName,
      data
    );
  }

  /**
   * Queue winner payment confirmed email
   */
  async queueWinnerPaymentConfirmedEmail(data: {
    recipientEmail: string;
    recipientName: string;
    auctionCode: string;
    auctionName: string;
    totalPaid: string;
    contractReady: boolean;
  }): Promise<string> {
    return this.addJob(
      EmailJob.WINNER_PAYMENT_CONFIRMED,
      data.recipientEmail,
      data.recipientName,
      data
    );
  }

  /**
   * Queue seller payment notification email
   */
  async queueSellerPaymentNotificationEmail(data: {
    recipientEmail: string;
    sellerName: string;
    buyerName: string;
    auctionCode: string;
    auctionName: string;
    totalPaid: string;
    contractReady: boolean;
  }): Promise<string> {
    return this.addJob(
      EmailJob.SELLER_PAYMENT_NOTIFICATION,
      data.recipientEmail,
      data.sellerName,
      data
    );
  }

  /**
   * Queue admin winner payment notification email
   */
  async queueAdminWinnerPaymentNotificationEmail(data: {
    recipientEmail: string;
    adminName: string;
    buyerName: string;
    buyerEmail: string;
    sellerName: string;
    auctionCode: string;
    auctionName: string;
    totalPaid: string;
    paidAt: Date;
    contractId: string;
  }): Promise<string> {
    return this.addJob(
      EmailJob.ADMIN_WINNER_PAYMENT_NOTIFICATION,
      data.recipientEmail,
      data.adminName,
      data
    );
  }

  // ============ Auction Results ============

  /**
   * Queue auction result email
   */
  async queueAuctionResultEmail(data: {
    recipientEmail: string;
    recipientName: string;
    auctionCode: string;
    auctionName: string;
    isWinner: boolean;
    winningAmount?: string;
    winnerName?: string;
    totalBids: number;
  }): Promise<string> {
    return this.addJob(
      EmailJob.AUCTION_RESULT,
      data.recipientEmail,
      data.recipientName,
      data
    );
  }

  // ============ Payment Failures & Reminders ============

  /**
   * Queue payment failure email
   */
  async queuePaymentFailureEmail(data: {
    recipientEmail: string;
    recipientName: string;
    auctionCode: string;
    auctionName: string;
    paymentType: 'deposit' | 'winning_payment';
    attemptedAmount: string;
    failureReason: string;
    retryUrl: string;
    deadline: Date;
  }): Promise<string> {
    return this.addJob(
      EmailJob.PAYMENT_FAILURE,
      data.recipientEmail,
      data.recipientName,
      data
    );
  }

  /**
   * Queue payment deadline reminder email
   */
  async queuePaymentDeadlineReminderEmail(data: {
    recipientEmail: string;
    recipientName: string;
    auctionCode: string;
    auctionName: string;
    paymentType: 'deposit' | 'winning_payment';
    amountDue: string;
    deadline: Date;
    daysRemaining: number;
    paymentUrl: string;
  }): Promise<string> {
    return this.addJob(
      EmailJob.PAYMENT_DEADLINE_REMINDER,
      data.recipientEmail,
      data.recipientName,
      data
    );
  }

  // ============ Refund Flow ============

  /**
   * Queue admin refund requested email
   */
  async queueAdminRefundRequestedEmail(data: {
    recipientEmail: string;
    adminName: string;
    userName: string;
    userEmail: string;
    auctionCode: string;
    auctionName: string;
    depositAmount: string;
    requestedAt: Date;
    reason?: string;
  }): Promise<string> {
    return this.addJob(
      EmailJob.ADMIN_REFUND_REQUESTED,
      data.recipientEmail,
      data.adminName,
      data
    );
  }

  /**
   * Queue user refund requested confirmation email
   */
  async queueUserRefundRequestedEmail(data: {
    recipientEmail: string;
    recipientName: string;
    auctionCode: string;
    auctionName: string;
    depositAmount: string;
    requestedAt: Date;
    reason?: string;
  }): Promise<string> {
    return this.addJob(
      EmailJob.USER_REFUND_REQUESTED,
      data.recipientEmail,
      data.recipientName,
      data
    );
  }

  /**
   * Queue refund approved email
   */
  async queueRefundApprovedEmail(data: {
    recipientEmail: string;
    recipientName: string;
    auctionCode: string;
    auctionName: string;
    refundAmount: string;
    approvedAt: Date;
  }): Promise<string> {
    return this.addJob(
      EmailJob.REFUND_APPROVED,
      data.recipientEmail,
      data.recipientName,
      data
    );
  }

  /**
   * Queue refund rejected email
   */
  async queueRefundRejectedEmail(data: {
    recipientEmail: string;
    recipientName: string;
    auctionCode: string;
    auctionName: string;
    depositAmount: string;
    rejectedAt: Date;
    rejectionReason: string;
  }): Promise<string> {
    return this.addJob(
      EmailJob.REFUND_REJECTED,
      data.recipientEmail,
      data.recipientName,
      data
    );
  }

  /**
   * Queue refund processed email
   */
  async queueRefundProcessedEmail(data: {
    recipientEmail: string;
    recipientName: string;
    auctionCode: string;
    auctionName: string;
    refundAmount: string;
    processedAt: Date;
  }): Promise<string> {
    return this.addJob(
      EmailJob.REFUND_PROCESSED,
      data.recipientEmail,
      data.recipientName,
      data
    );
  }
}
