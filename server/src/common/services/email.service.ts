import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { EmailTemplateService } from '../email/email-template.service';

export interface AuctionResultEmailData {
  recipientEmail: string;
  recipientName: string;
  auctionCode: string;
  auctionName: string;
  isWinner: boolean;
  winningAmount?: string;
  winnerName?: string;
  totalBids: number;
}

/**
 * Registration & deposit flow emails
 */
export interface DepositPaymentEmailData {
  recipientEmail: string;
  recipientName: string;
  auctionCode: string;
  auctionName: string;
  depositAmount: string;
  paymentUrl: string;
  qrCode?: string;
  deadline: Date;
}

export interface DepositConfirmedEmailData {
  recipientEmail: string;
  recipientName: string;
  auctionCode: string;
  auctionName: string;
  depositAmount: string;
  paidAt: Date;
  awaitingApproval: boolean;
}

export interface DocumentsVerifiedEmailData {
  recipientEmail: string;
  recipientName: string;
  auctionCode: string;
  auctionName: string;
  nextStep: 'pay_deposit' | 'awaiting_approval';
  depositAmount?: string;
  paymentDeadline?: Date;
}

export interface DocumentsRejectedEmailData {
  recipientEmail: string;
  recipientName: string;
  auctionCode: string;
  auctionName: string;
  rejectionReason: string;
  canResubmit: boolean;
  resubmitDeadline?: Date;
}

export interface FinalApprovalEmailData {
  recipientEmail: string;
  recipientName: string;
  auctionCode: string;
  auctionName: string;
  auctionStartAt: Date;
  canNowBid: boolean;
}

/**
 * Winner payment flow emails
 */
export interface WinnerPaymentRequestEmailData {
  recipientEmail: string;
  recipientName: string;
  auctionCode: string;
  auctionName: string;
  winningAmount: string;
  depositAlreadyPaid: string;
  dossierFee: string;
  totalDue: string;
  paymentDeadline: Date;
}

export interface WinnerPaymentConfirmedEmailData {
  recipientEmail: string;
  recipientName: string;
  auctionCode: string;
  auctionName: string;
  totalPaid: string;
  contractReady: boolean;
}

export interface PaymentFailureEmailData {
  recipientEmail: string;
  recipientName: string;
  auctionCode: string;
  auctionName: string;
  paymentType: 'deposit' | 'winning_payment';
  attemptedAmount: string;
  failureReason: string;
  retryUrl: string;
  deadline: Date;
}

export interface PaymentDeadlineReminderEmailData {
  recipientEmail: string;
  recipientName: string;
  auctionCode: string;
  auctionName: string;
  paymentType: 'deposit' | 'winning_payment';
  amountDue: string;
  deadline: Date;
  daysRemaining: number;
  paymentUrl: string;
}

/**
 * Admin notification emails
 */
export interface AdminDepositNotificationEmailData {
  recipientEmail: string;
  adminName: string;
  userName: string;
  userEmail: string;
  auctionCode: string;
  auctionName: string;
  depositAmount: string;
  paidAt: Date;
  registrationId: string;
}

export interface SellerPaymentNotificationEmailData {
  recipientEmail: string;
  sellerName: string;
  buyerName: string;
  auctionCode: string;
  auctionName: string;
  totalPaid: string;
  contractReady: boolean;
}

export interface AdminWinnerPaymentNotificationEmailData {
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
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private emailProvider: string;

  constructor(
    private configService: ConfigService,
    private templateService: EmailTemplateService
  ) {
    this.emailProvider = this.configService.get('EMAIL_PROVIDER', 'smtp');
    this.initializeEmailService();
    this.logger.log('Email service initialized with file-based templates');
  }

  /**
   * Initialize email service based on provider configuration
   */
  private initializeEmailService() {
    try {
      if (this.emailProvider === 'brevo') {
        this.initializeBrevoService();
      } else {
        this.initializeSMTPService();
      }
    } catch (error) {
      this.logger.error('Failed to initialize email service:', error);
    }
  }

  /**
   * Initialize Brevo API service
   */
  private initializeBrevoService() {
    const apiKey = this.configService.get('BREVO_API_KEY');
    if (!apiKey) {
      this.logger.error(
        'BREVO_API_KEY not configured, falling back to logging'
      );
      return;
    }
    this.logger.log('Email service initialized with Brevo API');
  }

  /**
   * Initialize SMTP service with nodemailer
   */
  private initializeSMTPService() {
    try {
      const smtpConfig = {
        host: this.configService.get('SMTP_HOST', 'smtp.gmail.com'),
        port: parseInt(this.configService.get('SMTP_PORT', '587')),
        secure: this.configService.get('SMTP_SECURE', 'false') === 'true', // true for 465, false for other ports
        auth: {
          user: this.configService.get('SMTP_USER'),
          pass: this.configService.get('SMTP_PASS'),
        },
        // Gmail specific settings
        tls: {
          rejectUnauthorized: false, // Allow self-signed certificates
        },
      };

      this.transporter = nodemailer.createTransport(smtpConfig);

      // Verify connection configuration
      this.transporter.verify((error) => {
        if (error) {
          this.logger.error('SMTP connection error:', error);
        } else {
          this.logger.log(
            `SMTP server is ready to take our messages via ${smtpConfig.host}`
          );
        }
      });
    } catch (error) {
      this.logger.error('Failed to initialize SMTP transporter:', error);
    }
  }

  /**
   * Send auction results email to participant
   */
  async sendAuctionResultEmail(data: AuctionResultEmailData): Promise<void> {
    try {
      const templatePath = data.isWinner
        ? 'auction-results/winner'
        : 'auction-results/non-winner';
      const subject = this.templateService.getSubject(templatePath, data);
      const htmlContent = await this.templateService.render(
        templatePath,
        data,
        subject
      );

      if (this.emailProvider === 'brevo') {
        await this.sendEmailViaBrevoGeneric(
          data.recipientEmail,
          data.recipientName,
          subject,
          htmlContent
        );
      } else {
        await this.sendEmailViaSMTPGeneric(
          data.recipientEmail,
          subject,
          htmlContent
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to send auction result email to ${data.recipientEmail}`,
        error
      );
      // Don't throw - email failure shouldn't break the auction finalization
    }
  }

  async sendTestEmail(recipientEmail: string): Promise<boolean> {
    try {
      if (this.emailProvider === 'brevo') {
        return await this.sendTestEmailViaBrevo(recipientEmail);
      } else {
        return await this.sendTestEmailViaSMTP(recipientEmail);
      }
    } catch (error) {
      this.logger.error(
        `Failed to send test email to ${recipientEmail}`,
        error
      );
      return false;
    }
  }

  /**
   * Send test email via Brevo API
   */
  private async sendTestEmailViaBrevo(
    recipientEmail: string
  ): Promise<boolean> {
    const apiKey = this.configService.get('BREVO_API_KEY');
    if (!apiKey) {
      this.logger.error('Brevo API key not configured');
      return false;
    }

    const brevoPayload = {
      sender: {
        name: this.configService.get('BREVO_FROM_NAME', 'Auction Hub'),
        email: this.configService.get(
          'BREVO_FROM_EMAIL',
          'noreply@auctionhub.com'
        ),
      },
      to: [
        {
          email: recipientEmail,
        },
      ],
      subject: 'Auction Hub - Brevo Email Configuration Test',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #2c5282;">✅ Brevo Email Configuration Test</h2>
          <p>This is a test email to verify that your Brevo API configuration is working correctly.</p>
          <p><strong>Test sent at:</strong> ${new Date().toLocaleString()}</p>
          <p style="color: #48bb78;"><strong>✅ SUCCESS!</strong> Your Brevo email service is configured correctly.</p>
          <p><small>Powered by Brevo API</small></p>
        </div>
      `,
    };

    try {
      const response = await axios.post(
        'https://api.brevo.com/v3/smtp/email',
        brevoPayload,
        {
          headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      this.logger.log(
        `Test email sent successfully via Brevo to ${recipientEmail}, Message ID: ${response.data.messageId}`
      );
      return true;
    } catch (error) {
      // Check if it's a 403 error (account disabled/suspended)
      if (error.response?.status === 403) {
        this.logger.error(
          `Brevo account appears to be disabled/suspended. Falling back to SMTP. Error: ${error.message}`
        );
        // Automatically fallback to SMTP
        return await this.sendTestEmailViaSMTP(recipientEmail);
      }
      throw error;
    }
  }

  /**
   * Send test email via SMTP
   */
  private async sendTestEmailViaSMTP(recipientEmail: string): Promise<boolean> {
    if (!this.transporter) {
      this.logger.error('Email transporter not initialized');
      return false;
    }

    const mailOptions = {
      from: {
        name: this.configService.get('SMTP_FROM_NAME', 'Auction Hub'),
        address: this.configService.get(
          'SMTP_FROM_EMAIL',
          this.configService.get('SMTP_USER')
        ),
      },
      to: recipientEmail,
      subject: 'Auction Hub - SMTP Email Configuration Test',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #2c5282;">✅ SMTP Email Configuration Test</h2>
          <p>This is a test email to verify that your SMTP configuration is working correctly.</p>
          <p><strong>Test sent at:</strong> ${new Date().toLocaleString()}</p>
          <p style="color: #48bb78;"><strong>✅ SUCCESS!</strong> Your SMTP email service is configured correctly.</p>
          <p><small>Powered by SMTP</small></p>
        </div>
      `,
    };

    const info = await this.transporter.sendMail(mailOptions);
    this.logger.log(
      `Test email sent successfully via SMTP to ${recipientEmail}, Message ID: ${info.messageId}`
    );
    return true;
  }

  /**
   * Get email service status
   */
  getEmailServiceStatus(): {
    provider: string;
    isConfigured: boolean;
    brevoApiKey?: string;
    smtpHost?: string;
    smtpUser?: string;
  } {
    if (this.emailProvider === 'brevo') {
      const brevoApiKey = this.configService.get('BREVO_API_KEY');
      return {
        provider: 'brevo',
        isConfigured: !!brevoApiKey,
        brevoApiKey: brevoApiKey ? `${brevoApiKey.substring(0, 8)}...` : null,
      };
    } else {
      return {
        provider: 'smtp',
        isConfigured: !!this.transporter,
        smtpHost: this.configService.get('SMTP_HOST') || null,
        smtpUser: this.configService.get('SMTP_USER') || null,
      };
    }
  }

  /**
   * Generic helper to send via Brevo (to avoid code duplication)
   */
  private async sendEmailViaBrevoGeneric(
    recipientEmail: string,
    recipientName: string,
    subject: string,
    htmlContent: string
  ): Promise<void> {
    const apiKey = this.configService.get('BREVO_API_KEY');
    if (!apiKey) {
      this.logger.warn('Brevo API key not configured, falling back to logging');
      this.logEmailContentGeneric(recipientEmail, subject, htmlContent);
      return;
    }

    const brevoPayload = {
      sender: {
        name: this.configService.get('BREVO_FROM_NAME', 'Auction Hub'),
        email: this.configService.get(
          'BREVO_FROM_EMAIL',
          'noreply@auctionhub.com'
        ),
      },
      to: [{ email: recipientEmail, name: recipientName }],
      subject: subject,
      htmlContent: htmlContent,
    };

    try {
      const response = await axios.post(
        'https://api.brevo.com/v3/smtp/email',
        brevoPayload,
        {
          headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
          },
        }
      );
      this.logger.log(
        `Email sent via Brevo to ${recipientEmail}, Message ID: ${response.data.messageId}`
      );
    } catch (error) {
      if (error.response?.status === 403) {
        this.logger.warn(
          `Brevo account disabled/suspended. Falling back to SMTP for ${recipientEmail}`
        );
        await this.sendEmailViaSMTPGeneric(
          recipientEmail,
          subject,
          htmlContent
        );
        return;
      }
      throw error;
    }
  }

  /**
   * Generic helper to send via SMTP (to avoid code duplication)
   */
  private async sendEmailViaSMTPGeneric(
    recipientEmail: string,
    subject: string,
    htmlContent: string
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        'Email transporter not initialized, logging email instead'
      );
      this.logEmailContentGeneric(recipientEmail, subject, htmlContent);
      return;
    }

    const mailOptions = {
      from: {
        name: this.configService.get('SMTP_FROM_NAME', 'Auction Hub'),
        address: this.configService.get(
          'SMTP_FROM_EMAIL',
          this.configService.get('SMTP_USER')
        ),
      },
      to: recipientEmail,
      subject: subject,
      html: htmlContent,
    };

    const info = await this.transporter.sendMail(mailOptions);
    this.logger.log(
      `Email sent via SMTP to ${recipientEmail}, Message ID: ${info.messageId}`
    );
  }

  /**
   * Generic helper to log email content (to avoid code duplication)
   */
  private logEmailContentGeneric(
    recipientEmail: string,
    subject: string,
    htmlContent: string
  ): void {
    this.logger.log(`
      ========================================
      EMAIL TO: ${recipientEmail}
      SUBJECT: ${subject}
      ========================================
      ${htmlContent}
      ========================================
    `);
  }

  /**
   * Send documents verified email to user
   */
  async sendDocumentsVerifiedEmail(
    data: DocumentsVerifiedEmailData
  ): Promise<void> {
    try {
      const templatePath = 'registration/documents-verified';
      const subject = this.templateService.getSubject(templatePath, data);
      const htmlContent = await this.templateService.render(
        templatePath,
        data,
        subject
      );

      if (this.emailProvider === 'brevo') {
        await this.sendEmailViaBrevoGeneric(
          data.recipientEmail,
          data.recipientName,
          subject,
          htmlContent
        );
      } else {
        await this.sendEmailViaSMTPGeneric(
          data.recipientEmail,
          subject,
          htmlContent
        );
      }

      this.logger.log(
        `Documents verified email sent to ${data.recipientEmail}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to send documents verified email to ${data.recipientEmail}`,
        error
      );
      this.logEmailContentGeneric(
        data.recipientEmail,
        'Documents Verified',
        ''
      );
    }
  }

  /**
   * Send deposit payment request email
   */
  async sendDepositPaymentRequestEmail(
    data: DepositPaymentEmailData
  ): Promise<void> {
    try {
      const templatePath = 'registration/deposit-payment-request';
      const subject = this.templateService.getSubject(templatePath, data);
      const htmlContent = await this.templateService.render(
        templatePath,
        data,
        subject
      );

      if (this.emailProvider === 'brevo') {
        await this.sendEmailViaBrevoGeneric(
          data.recipientEmail,
          data.recipientName,
          subject,
          htmlContent
        );
      } else {
        await this.sendEmailViaSMTPGeneric(
          data.recipientEmail,
          subject,
          htmlContent
        );
      }

      this.logger.log(
        `Deposit payment request email sent to ${data.recipientEmail}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to send deposit payment request email to ${data.recipientEmail}`,
        error
      );
      this.logEmailContentGeneric(
        data.recipientEmail,
        'Deposit Payment Request',
        ''
      );
    }
  }

  /**
   * Send deposit confirmed notification
   */
  async sendDepositConfirmedEmail(
    data: DepositConfirmedEmailData
  ): Promise<void> {
    try {
      const templatePath = 'registration/deposit-confirmed';
      const subject = this.templateService.getSubject(templatePath, data);
      const htmlContent = await this.templateService.render(
        templatePath,
        data,
        subject
      );

      if (this.emailProvider === 'brevo') {
        await this.sendEmailViaBrevoGeneric(
          data.recipientEmail,
          data.recipientName,
          subject,
          htmlContent
        );
      } else {
        await this.sendEmailViaSMTPGeneric(
          data.recipientEmail,
          subject,
          htmlContent
        );
      }

      this.logger.log(`Deposit confirmed email sent to ${data.recipientEmail}`);
    } catch (error) {
      this.logger.error(
        `Failed to send deposit confirmed email to ${data.recipientEmail}`,
        error
      );
      this.logEmailContentGeneric(data.recipientEmail, 'Deposit Confirmed', '');
    }
  }

  /**
   * Send final approval notification
   */
  async sendFinalApprovalEmail(data: FinalApprovalEmailData): Promise<void> {
    try {
      const templatePath = 'registration/final-approval';
      const subject = this.templateService.getSubject(templatePath, data);
      const htmlContent = await this.templateService.render(
        templatePath,
        data,
        subject
      );

      if (this.emailProvider === 'brevo') {
        await this.sendEmailViaBrevoGeneric(
          data.recipientEmail,
          data.recipientName,
          subject,
          htmlContent
        );
      } else {
        await this.sendEmailViaSMTPGeneric(
          data.recipientEmail,
          subject,
          htmlContent
        );
      }

      this.logger.log(`Final approval email sent to ${data.recipientEmail}`);
    } catch (error) {
      this.logger.error(
        `Failed to send final approval email to ${data.recipientEmail}`,
        error
      );
      this.logEmailContentGeneric(data.recipientEmail, 'Final Approval', '');
    }
  }

  /**
   * Send winner payment request email
   */
  async sendWinnerPaymentRequestEmail(
    data: WinnerPaymentRequestEmailData
  ): Promise<void> {
    try {
      const templatePath = 'payments/winner-payment-request';
      const subject = this.templateService.getSubject(templatePath, data);
      const htmlContent = await this.templateService.render(
        templatePath,
        data,
        subject
      );

      if (this.emailProvider === 'brevo') {
        await this.sendEmailViaBrevoGeneric(
          data.recipientEmail,
          data.recipientName,
          subject,
          htmlContent
        );
      } else {
        await this.sendEmailViaSMTPGeneric(
          data.recipientEmail,
          subject,
          htmlContent
        );
      }

      this.logger.log(
        `Winner payment request email sent to ${data.recipientEmail}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to send winner payment request email to ${data.recipientEmail}`,
        error
      );
      this.logEmailContentGeneric(
        data.recipientEmail,
        'Winner Payment Request',
        ''
      );
    }
  }

  /**
   * Send winner payment confirmed notification
   */
  async sendWinnerPaymentConfirmedEmail(
    data: WinnerPaymentConfirmedEmailData
  ): Promise<void> {
    try {
      const templatePath = 'payments/winner-payment-confirmed';
      const subject = this.templateService.getSubject(templatePath, data);
      const htmlContent = await this.templateService.render(
        templatePath,
        data,
        subject
      );

      if (this.emailProvider === 'brevo') {
        await this.sendEmailViaBrevoGeneric(
          data.recipientEmail,
          data.recipientName,
          subject,
          htmlContent
        );
      } else {
        await this.sendEmailViaSMTPGeneric(
          data.recipientEmail,
          subject,
          htmlContent
        );
      }

      this.logger.log(
        `Winner payment confirmed email sent to ${data.recipientEmail}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to send winner payment confirmed email to ${data.recipientEmail}`,
        error
      );
      this.logEmailContentGeneric(
        data.recipientEmail,
        'Winner Payment Confirmed',
        ''
      );
    }
  }

  /**
   * Send payment failure notification
   */
  async sendPaymentFailureEmail(data: PaymentFailureEmailData): Promise<void> {
    try {
      const templatePath = 'payments/payment-failure';
      const subject = this.templateService.getSubject(templatePath, data);
      const htmlContent = await this.templateService.render(
        templatePath,
        data,
        subject
      );

      if (this.emailProvider === 'brevo') {
        await this.sendEmailViaBrevoGeneric(
          data.recipientEmail,
          data.recipientName,
          subject,
          htmlContent
        );
      } else {
        await this.sendEmailViaSMTPGeneric(
          data.recipientEmail,
          subject,
          htmlContent
        );
      }

      this.logger.log(`Payment failure email sent to ${data.recipientEmail}`);
    } catch (error) {
      this.logger.error(
        `Failed to send payment failure email to ${data.recipientEmail}`,
        error
      );
      this.logEmailContentGeneric(data.recipientEmail, 'Payment Failed', '');
    }
  }

  /**
   * Send payment deadline reminder
   */
  async sendPaymentDeadlineReminderEmail(
    data: PaymentDeadlineReminderEmailData
  ): Promise<void> {
    try {
      const templatePath = 'payments/payment-reminder';
      const subject = this.templateService.getSubject(templatePath, data);
      const htmlContent = await this.templateService.render(
        templatePath,
        data,
        subject
      );

      if (this.emailProvider === 'brevo') {
        await this.sendEmailViaBrevoGeneric(
          data.recipientEmail,
          data.recipientName,
          subject,
          htmlContent
        );
      } else {
        await this.sendEmailViaSMTPGeneric(
          data.recipientEmail,
          subject,
          htmlContent
        );
      }

      this.logger.log(
        `Payment deadline reminder email sent to ${data.recipientEmail}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to send payment deadline reminder email to ${data.recipientEmail}`,
        error
      );
      this.logEmailContentGeneric(
        data.recipientEmail,
        'Payment Deadline Reminder',
        ''
      );
    }
  }

  /**
   * Send admin notification for deposit payment
   */
  async sendAdminDepositNotificationEmail(
    data: AdminDepositNotificationEmailData
  ): Promise<void> {
    try {
      const templatePath = 'admin/deposit-notification';
      const subject = this.templateService.getSubject(templatePath, data);
      const htmlContent = await this.templateService.render(
        templatePath,
        data,
        subject
      );

      if (this.emailProvider === 'brevo') {
        await this.sendEmailViaBrevoGeneric(
          data.recipientEmail,
          data.adminName,
          subject,
          htmlContent
        );
      } else {
        await this.sendEmailViaSMTPGeneric(
          data.recipientEmail,
          subject,
          htmlContent
        );
      }

      this.logger.log(
        `Admin deposit notification email sent to ${data.recipientEmail}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to send admin deposit notification email to ${data.recipientEmail}`,
        error
      );
      this.logEmailContentGeneric(
        data.recipientEmail,
        'Admin Deposit Notification',
        ''
      );
    }
  }

  /**
   * Send seller notification for winner payment
   */
  async sendSellerPaymentNotificationEmail(
    data: SellerPaymentNotificationEmailData
  ): Promise<void> {
    try {
      const templatePath = 'admin/seller-payment-notification';
      const subject = this.templateService.getSubject(templatePath, data);
      const htmlContent = await this.templateService.render(
        templatePath,
        data,
        subject
      );

      if (this.emailProvider === 'brevo') {
        await this.sendEmailViaBrevoGeneric(
          data.recipientEmail,
          data.sellerName,
          subject,
          htmlContent
        );
      } else {
        await this.sendEmailViaSMTPGeneric(
          data.recipientEmail,
          subject,
          htmlContent
        );
      }

      this.logger.log(
        `Seller payment notification email sent to ${data.recipientEmail}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to send seller payment notification email to ${data.recipientEmail}`,
        error
      );
      this.logEmailContentGeneric(
        data.recipientEmail,
        'Seller Payment Notification',
        ''
      );
    }
  }

  /**
   * Send admin notification for winner payment
   */
  async sendAdminWinnerPaymentNotificationEmail(
    data: AdminWinnerPaymentNotificationEmailData
  ): Promise<void> {
    try {
      const templatePath = 'admin/winner-payment-notification';
      const subject = this.templateService.getSubject(templatePath, data);
      const htmlContent = await this.templateService.render(
        templatePath,
        data,
        subject
      );

      if (this.emailProvider === 'brevo') {
        await this.sendEmailViaBrevoGeneric(
          data.recipientEmail,
          data.adminName,
          subject,
          htmlContent
        );
      } else {
        await this.sendEmailViaSMTPGeneric(
          data.recipientEmail,
          subject,
          htmlContent
        );
      }

      this.logger.log(
        `Admin winner payment notification email sent to ${data.recipientEmail}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to send admin winner payment notification email to ${data.recipientEmail}`,
        error
      );
      this.logEmailContentGeneric(
        data.recipientEmail,
        'Admin Winner Payment Notification',
        ''
      );
    }
  }
}
