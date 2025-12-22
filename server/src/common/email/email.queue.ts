/**
 * Email Queue Configuration
 * Simple queue for background email processing using BullMQ
 */

export const EMAIL_QUEUE = 'email-queue';

/**
 * Email job types - each type corresponds to an email sending method
 */
export enum EmailJob {
  // Registration & Document flow
  DOCUMENTS_VERIFIED = 'documents-verified',
  FINAL_APPROVAL = 'final-approval',

  // Deposit flow
  DEPOSIT_PAYMENT_REQUEST = 'deposit-payment-request',
  DEPOSIT_CONFIRMED = 'deposit-confirmed',
  ADMIN_DEPOSIT_NOTIFICATION = 'admin-deposit-notification',

  // Winner payment flow
  WINNER_PAYMENT_REQUEST = 'winner-payment-request',
  WINNER_PAYMENT_CONFIRMED = 'winner-payment-confirmed',
  SELLER_PAYMENT_NOTIFICATION = 'seller-payment-notification',
  ADMIN_WINNER_PAYMENT_NOTIFICATION = 'admin-winner-payment-notification',

  // Auction results
  AUCTION_RESULT = 'auction-result',

  // Payment failures & reminders
  PAYMENT_FAILURE = 'payment-failure',
  PAYMENT_DEADLINE_REMINDER = 'payment-deadline-reminder',

  // Refund flow
  ADMIN_REFUND_REQUESTED = 'admin-refund-requested',
  USER_REFUND_REQUESTED = 'user-refund-requested',
  REFUND_APPROVED = 'refund-approved',
  REFUND_REJECTED = 'refund-rejected',
  REFUND_PROCESSED = 'refund-processed',
}

/**
 * Base interface for all email jobs
 */
export interface BaseEmailJobData {
  jobType: EmailJob;
  recipientEmail: string;
  recipientName?: string;
}

/**
 * Generic email job data (for any email type)
 * The payload contains the specific data for each email type
 */
export interface EmailJobData extends BaseEmailJobData {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>;
}
