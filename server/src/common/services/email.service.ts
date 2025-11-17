import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

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

  constructor(private configService: ConfigService) {
    this.emailProvider = this.configService.get('EMAIL_PROVIDER', 'smtp');
    this.initializeEmailService();
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
      if (this.emailProvider === 'brevo') {
        await this.sendEmailViaBrevo(data);
      } else {
        await this.sendEmailViaSMTP(data);
      }
    } catch (error) {
      this.logger.error(
        `Failed to send auction result email to ${data.recipientEmail}`,
        error
      );
      // Fallback to logging email content
      this.logEmailContent(data);
      // Don't throw - email failure shouldn't break the auction finalization
    }
  }

  /**
   * Send email using Brevo API
   */
  private async sendEmailViaBrevo(data: AuctionResultEmailData): Promise<void> {
    const apiKey = this.configService.get('BREVO_API_KEY');
    if (!apiKey) {
      this.logger.warn('Brevo API key not configured, falling back to logging');
      this.logEmailContent(data);
      return;
    }

    const emailContent = this.generateAuctionResultEmail(data);
    const subject = data.isWinner
      ? `🎉 Congratulations! You won auction ${data.auctionCode}`
      : `Auction Results - ${data.auctionCode}`;

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
          email: data.recipientEmail,
          name: data.recipientName,
        },
      ],
      subject: subject,
      htmlContent: emailContent,
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
        `Auction result email sent via Brevo to ${data.recipientEmail}, Message ID: ${response.data.messageId}`
      );
    } catch (error) {
      // Check if it's a 403 error (account disabled/suspended)
      if (error.response?.status === 403) {
        this.logger.warn(
          `Brevo account disabled/suspended. Falling back to SMTP for ${data.recipientEmail}`
        );
        // Automatically fallback to SMTP
        await this.sendEmailViaSMTP(data);
        return;
      }
      throw error;
    }
  }

  /**
   * Send email using SMTP (nodemailer)
   */
  private async sendEmailViaSMTP(data: AuctionResultEmailData): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        'Email transporter not initialized, logging email instead'
      );
      this.logEmailContent(data);
      return;
    }

    const emailContent = this.generateAuctionResultEmail(data);
    const subject = data.isWinner
      ? `🎉 Congratulations! You won auction ${data.auctionCode}`
      : `Auction Results - ${data.auctionCode}`;

    const mailOptions = {
      from: {
        name: this.configService.get('SMTP_FROM_NAME', 'Auction Hub'),
        address: this.configService.get(
          'SMTP_FROM_EMAIL',
          this.configService.get('SMTP_USER')
        ),
      },
      to: data.recipientEmail,
      subject: subject,
      html: emailContent,
    };

    const info = await this.transporter.sendMail(mailOptions);
    this.logger.log(
      `Auction result email sent via SMTP to ${data.recipientEmail}, Message ID: ${info.messageId}`
    );
  }

  /**
   * Log email content as fallback when email sending fails
   */
  private logEmailContent(data: AuctionResultEmailData): void {
    const emailContent = this.generateAuctionResultEmail(data);
    this.logger.log(`
      ========================================
      EMAIL TO: ${data.recipientEmail}
      SUBJECT: Auction Results - ${data.auctionCode}
      ========================================
      ${emailContent}
      ========================================
    `);
  }

  /**
   * Generate HTML email content for auction results
   */
  private generateAuctionResultEmail(data: AuctionResultEmailData): string {
    const baseStyles = `
      <style>
        .email-container { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2c5282; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f7fafc; padding: 20px; border-radius: 0 0 8px 8px; }
        .details-box { background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #2c5282; }
        .winner-badge { background-color: #48bb78; color: white; padding: 10px 20px; border-radius: 20px; display: inline-block; margin: 10px 0; }
        .footer { color: #718096; font-size: 14px; margin-top: 30px; text-align: center; }
        .button { background-color: #2c5282; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 15px 0; }
      </style>
    `;

    if (data.isWinner) {
      return `
        <html>
          <head>${baseStyles}</head>
          <body>
            <div class="email-container">
              <div class="header">
                <h1>🎉 Congratulations!</h1>
                <p>You are the winning bidder!</p>
              </div>
              
              <div class="content">
                <h2>Dear ${data.recipientName},</h2>
                
                <div class="winner-badge">
                  ✅ WINNING BIDDER
                </div>
                
                <p>We're excited to inform you that you've won auction <strong>${data.auctionCode}</strong>!</p>

                <div class="details-box">
                  <h3>📋 Auction Details</h3>
                  <p><strong>Auction:</strong> ${data.auctionName}</p>
                  <p><strong>Your Winning Bid:</strong> <span style="color: #48bb78; font-size: 18px; font-weight: bold;">$${data.winningAmount}</span></p>
                  <p><strong>Total Bids Received:</strong> ${data.totalBids}</p>
                  <p><strong>Auction Code:</strong> ${data.auctionCode}</p>
                </div>

                <h3>📞 Next Steps</h3>
                <p>Our team will contact you within 24 hours to:</p>
                <ul>
                  <li>Complete the necessary paperwork</li>
                  <li>Arrange payment details</li>
                  <li>Schedule property handover</li>
                  <li>Finalize the legal documentation</li>
                </ul>

                <a href="#" class="button">View Contract Details</a>

                <div class="footer">
                  <p>Thank you for choosing Auction Hub!</p>
                  <p>If you have any questions, please contact our support team.</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;
    } else {
      return `
        <html>
          <head>${baseStyles}</head>
          <body>
            <div class="email-container">
              <div class="header">
                <h1>📊 Auction Results</h1>
                <p>Auction ${data.auctionCode}</p>
              </div>
              
              <div class="content">
                <h2>Dear ${data.recipientName},</h2>
                
                <p>Thank you for participating in auction <strong>${
                  data.auctionCode
                }</strong>.</p>

                <div class="details-box">
                  <h3>📋 Auction Summary</h3>
                  <p><strong>Auction:</strong> ${data.auctionName}</p>
                  <p><strong>Auction Code:</strong> ${data.auctionCode}</p>
                  ${
                    data.winnerName
                      ? `<p><strong>Winning Bidder:</strong> ${data.winnerName}</p>`
                      : '<p><strong>Result:</strong> No winner</p>'
                  }
                  ${
                    data.winningAmount
                      ? `<p><strong>Winning Amount:</strong> <span style="color: #48bb78; font-weight: bold;">$${data.winningAmount}</span></p>`
                      : ''
                  }
                  <p><strong>Total Bids Received:</strong> ${data.totalBids}</p>
                </div>

                <p>While you weren't the winning bidder this time, we appreciate your participation and interest.</p>
                
                <h3>🔔 Stay Connected</h3>
                <p>Don't miss out on future opportunities:</p>
                <ul>
                  <li>Browse our upcoming auctions</li>
                  <li>Set up alerts for properties in your area</li>
                  <li>Follow us for the latest auction announcements</li>
                </ul>

                <a href="#" class="button">View Upcoming Auctions</a>

                <div class="footer">
                  <p>Thank you for being part of the Auction Hub community!</p>
                  <p>We look forward to seeing you at future auctions.</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;
    }
  }

  /**
   * Send bulk auction result emails to all participants
   */
  async sendBulkAuctionResultEmails(
    emails: AuctionResultEmailData[]
  ): Promise<void> {
    const promises = emails.map((emailData) =>
      this.sendAuctionResultEmail(emailData)
    );
    const results = await Promise.allSettled(promises);

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    this.logger.log(
      `Bulk email sending completed: ${successful} successful, ${failed} failed`
    );

    if (failed > 0) {
      this.logger.warn(`${failed} emails failed to send`);
    }
  }

  /**
   * Send test email to verify email configuration
   */
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
   * Send documents verified notification
   */
  async sendDocumentsVerifiedEmail(
    data: DocumentsVerifiedEmailData
  ): Promise<void> {
    try {
      const htmlContent = this.generateDocumentsVerifiedEmail(data);
      const subject = `Documents Verified - ${data.auctionCode}`;

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
        this.generateDocumentsVerifiedEmail(data)
      );
    }
  }

  /**
   * Send deposit payment request email
   */
  async sendDepositPaymentRequestEmail(
    data: DepositPaymentEmailData
  ): Promise<void> {
    let htmlContent: string;
    let subject: string;
    try {
      htmlContent = this.generateDepositPaymentRequestEmail(data);
      subject = `💰 Deposit Payment Required - ${data.auctionCode}`;

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
      this.logEmailContentGeneric(data.recipientEmail, subject, htmlContent);
    }
  }

  /**
   * Send deposit confirmed notification
   */
  async sendDepositConfirmedEmail(
    data: DepositConfirmedEmailData
  ): Promise<void> {
    let htmlContent: string;
    let subject: string;
    try {
      htmlContent = this.generateDepositConfirmedEmail(data);
      subject = `✅ Deposit Payment Confirmed - ${data.auctionCode}`;

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
      this.logEmailContentGeneric(data.recipientEmail, subject, htmlContent);
    }
  }

  /**
   * Send final approval notification
   */
  async sendFinalApprovalEmail(data: FinalApprovalEmailData): Promise<void> {
    let htmlContent: string;
    let subject: string;
    try {
      htmlContent = this.generateFinalApprovalEmail(data);
      subject = `🎉 Registration Approved - ${data.auctionCode}`;

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
      this.logEmailContentGeneric(data.recipientEmail, subject, htmlContent);
    }
  }

  /**
   * Send winner payment request email
   */
  async sendWinnerPaymentRequestEmail(
    data: WinnerPaymentRequestEmailData
  ): Promise<void> {
    let htmlContent: string;
    let subject: string;
    try {
      htmlContent = this.generateWinnerPaymentRequestEmail(data);
      subject = `🎉 Winner Payment Required - ${data.auctionCode}`;

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
      this.logEmailContentGeneric(data.recipientEmail, subject, htmlContent);
    }
  }

  /**
   * Send winner payment confirmed notification
   */
  async sendWinnerPaymentConfirmedEmail(
    data: WinnerPaymentConfirmedEmailData
  ): Promise<void> {
    let htmlContent: string;
    let subject: string;
    try {
      htmlContent = this.generateWinnerPaymentConfirmedEmail(data);
      subject = `✅ Payment Confirmed - Contract Ready - ${data.auctionCode}`;

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
      this.logEmailContentGeneric(data.recipientEmail, subject, htmlContent);
    }
  }

  /**
   * Send payment failure notification
   */
  async sendPaymentFailureEmail(data: PaymentFailureEmailData): Promise<void> {
    let htmlContent: string;
    let subject: string;
    try {
      htmlContent = this.generatePaymentFailureEmail(data);
      subject = `⚠️ Payment Failed - ${data.auctionCode}`;

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
      this.logEmailContentGeneric(data.recipientEmail, subject, htmlContent);
    }
  }

  /**
   * Send payment deadline reminder
   */
  async sendPaymentDeadlineReminderEmail(
    data: PaymentDeadlineReminderEmailData
  ): Promise<void> {
    let htmlContent: string;
    let subject: string;
    try {
      htmlContent = this.generatePaymentDeadlineReminderEmail(data);
      subject = `⏰ Payment Deadline Reminder - ${data.auctionCode}`;

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
      this.logEmailContentGeneric(data.recipientEmail, subject, htmlContent);
    }
  }

  /**
   * Send admin notification for deposit payment
   */
  async sendAdminDepositNotificationEmail(
    data: AdminDepositNotificationEmailData
  ): Promise<void> {
    let htmlContent: string;
    let subject: string;
    try {
      htmlContent = this.generateAdminDepositNotificationEmail(data);
      subject = `🔔 New Deposit Payment - ${data.auctionCode}`;

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
      this.logEmailContentGeneric(data.recipientEmail, subject, htmlContent);
    }
  }

  /**
   * Send seller notification for winner payment
   */
  async sendSellerPaymentNotificationEmail(
    data: SellerPaymentNotificationEmailData
  ): Promise<void> {
    let htmlContent: string;
    let subject: string;
    try {
      htmlContent = this.generateSellerPaymentNotificationEmail(data);
      subject = `💰 Winner Payment Received - ${data.auctionCode}`;

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
      this.logEmailContentGeneric(data.recipientEmail, subject, htmlContent);
    }
  }

  /**
   * Send admin notification for winner payment
   */
  async sendAdminWinnerPaymentNotificationEmail(
    data: AdminWinnerPaymentNotificationEmailData
  ): Promise<void> {
    let htmlContent: string;
    let subject: string;
    try {
      htmlContent = this.generateAdminWinnerPaymentNotificationEmail(data);
      subject = `💰 Winner Payment Confirmed - ${data.auctionCode}`;

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
      this.logEmailContentGeneric(data.recipientEmail, subject, htmlContent);
    }
  }

  /**
   * Extract base email styles to reusable method
   */
  private getBaseEmailStyles(): string {
    return `
      <style>
        .email-container { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2c5282; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f7fafc; padding: 20px; border-radius: 0 0 8px 8px; }
        .details-box { background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #2c5282; }
        .winner-badge { background-color: #48bb78; color: white; padding: 10px 20px; border-radius: 20px; display: inline-block; margin: 10px 0; }
        .footer { color: #718096; font-size: 14px; margin-top: 30px; text-align: center; }
        .button { background-color: #2c5282; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 15px 0; }
      </style>
    `;
  }

  /**
   * Generate HTML for documents verified email
   */
  private generateDocumentsVerifiedEmail(
    data: DocumentsVerifiedEmailData
  ): string {
    const baseStyles = this.getBaseEmailStyles();

    return `
      <html>
        <head>${baseStyles}</head>
        <body>
          <div class="email-container">
            <div class="header">
              <h1>✅ Documents Verified</h1>
              <p>Your registration documents have been approved</p>
            </div>

            <div class="content">
              <h2>Dear ${data.recipientName},</h2>

              <p>Great news! Your registration documents for auction <strong>${
                data.auctionCode
              }</strong> have been verified and approved.</p>

              <div class="details-box">
                <h3>📋 Auction Details</h3>
                <p><strong>Auction:</strong> ${data.auctionName}</p>
                <p><strong>Auction Code:</strong> ${data.auctionCode}</p>
              </div>

              ${
                data.nextStep === 'pay_deposit'
                  ? `
                <h3>📞 Next Step: Pay Deposit</h3>
                <p>To complete your registration, you must pay the deposit amount:</p>
                <div class="details-box" style="background-color: #fef5e7; border-left-color: #f39c12;">
                  <p><strong>Deposit Amount:</strong> <span style="color: #f39c12; font-size: 20px; font-weight: bold;">${
                    data.depositAmount
                  } VND</span></p>
                  <p><strong>Payment Deadline:</strong> ${data.paymentDeadline?.toLocaleString()}</p>
                </div>
                <p><strong>⏰ Important:</strong> You must complete payment within 24 hours to proceed with your registration.</p>
              `
                  : `
                <h3>📞 Next Step: Awaiting Final Approval</h3>
                <p>Your registration is now awaiting final approval from the auctioneer. You will be notified via email once approved.</p>
              `
              }

              <div class="footer">
                <p>Thank you for choosing Auction Hub!</p>
                <p>If you have any questions, please contact our support team.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate HTML for deposit payment request email
   */
  private generateDepositPaymentRequestEmail(
    data: DepositPaymentEmailData
  ): string {
    const baseStyles = this.getBaseEmailStyles();

    return `
      <html>
        <head>${baseStyles}</head>
        <body>
          <div class="email-container">
            <div class="header">
              <h1>💰 Deposit Payment Required</h1>
              <p>Complete your registration</p>
            </div>

            <div class="content">
              <h2>Dear ${data.recipientName},</h2>

              <p>Your documents have been verified! To complete your registration for auction <strong>${
                data.auctionCode
              }</strong>, please pay the deposit amount.</p>

              <div class="details-box" style="background-color: #fef5e7; border-left-color: #f39c12;">
                <h3>💵 Payment Details</h3>
                <p><strong>Deposit Amount:</strong> <span style="color: #f39c12; font-size: 24px; font-weight: bold;">${
                  data.depositAmount
                } VND</span></p>
                <p><strong>Auction:</strong> ${data.auctionName}</p>
                <p><strong>Auction Code:</strong> ${data.auctionCode}</p>
                <p><strong>Payment Deadline:</strong> <span style="color: #e74c3c; font-weight: bold;">${data.deadline.toLocaleString()}</span></p>
              </div>

              <a href="${data.paymentUrl}" class="button">Pay Deposit Now</a>

              ${
                data.qrCode
                  ? `
                <div class="details-box">
                  <h3>📱 QR Code Payment</h3>
                  <p>Scan this QR code with your banking app:</p>
                  <img src="${data.qrCode}" alt="QR Code" style="max-width: 200px; margin: 10px 0;" />
                </div>
              `
                  : ''
              }

              <h3>⚠️ Important Reminders</h3>
              <ul>
                <li>Payment must be completed within <strong>24 hours</strong></li>
                <li>Registration will be <strong>automatically cancelled</strong> if payment is not received by the deadline</li>
                <li>You will receive a confirmation email once payment is verified</li>
              </ul>

              <div class="footer">
                <p>Need help? Contact our support team.</p>
                <p>Payment deadline: ${data.deadline.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate HTML for deposit confirmed email
   */
  private generateDepositConfirmedEmail(
    data: DepositConfirmedEmailData
  ): string {
    const baseStyles = this.getBaseEmailStyles();

    return `
      <html>
        <head>${baseStyles}</head>
        <body>
          <div class="email-container">
            <div class="header">
              <h1>✅ Deposit Payment Confirmed</h1>
              <p>Your payment has been received</p>
            </div>

            <div class="content">
              <h2>Dear ${data.recipientName},</h2>

              <div class="winner-badge" style="background-color: #48bb78;">
                ✅ PAYMENT RECEIVED
              </div>

              <p>Your deposit payment for auction <strong>${
                data.auctionCode
              }</strong> has been successfully verified!</p>

              <div class="details-box">
                <h3>💰 Payment Summary</h3>
                <p><strong>Amount Paid:</strong> <span style="color: #48bb78; font-size: 20px; font-weight: bold;">${
                  data.depositAmount
                } VND</span></p>
                <p><strong>Payment Date:</strong> ${data.paidAt.toLocaleString()}</p>
                <p><strong>Auction:</strong> ${data.auctionName}</p>
                <p><strong>Auction Code:</strong> ${data.auctionCode}</p>
              </div>

              ${
                data.awaitingApproval
                  ? `
                <h3>📞 Next Step</h3>
                <p>Your registration is now awaiting final approval from the auctioneer. You will be notified via email once approved and you can start bidding!</p>
                <p><strong>Estimated approval time:</strong> Within 24-48 hours</p>
              `
                  : `
                <h3>🎉 You're All Set!</h3>
                <p>Your registration is complete and you can now participate in the auction!</p>
              `
              }

              <div class="footer">
                <p>Thank you for your payment!</p>
                <p>If you have any questions, please contact our support team.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate HTML for final approval email
   */
  private generateFinalApprovalEmail(data: FinalApprovalEmailData): string {
    const baseStyles = this.getBaseEmailStyles();

    return `
      <html>
        <head>${baseStyles}</head>
        <body>
          <div class="email-container">
            <div class="header">
              <h1>🎉 Registration Approved!</h1>
              <p>You can now participate in the auction</p>
            </div>

            <div class="content">
              <h2>Dear ${data.recipientName},</h2>

              <div class="winner-badge" style="background-color: #48bb78;">
                ✅ APPROVED - READY TO BID
              </div>

              <p>Congratulations! Your registration for auction <strong>${
                data.auctionCode
              }</strong> has been approved.</p>

              <div class="details-box">
                <h3>📋 Auction Details</h3>
                <p><strong>Auction:</strong> ${data.auctionName}</p>
                <p><strong>Auction Code:</strong> ${data.auctionCode}</p>
                <p><strong>Auction Starts:</strong> ${data.auctionStartAt.toLocaleString()}</p>
              </div>

              ${
                data.canNowBid
                  ? `
                <h3>🔨 You Can Now Bid!</h3>
                <p>Your registration is complete and you are authorized to place bids in this auction.</p>

                <a href="#" class="button">Go to Auction</a>

                <h3>📝 Bidding Guidelines</h3>
                <ul>
                  <li>Ensure you understand the bidding rules and increments</li>
                  <li>All bids are binding commitments</li>
                  <li>The highest bidder at auction close wins</li>
                  <li>Winner must complete payment within 7 days</li>
                </ul>
              `
                  : ''
              }

              <div class="footer">
                <p>Good luck with your bidding!</p>
                <p>If you have any questions, please contact our support team.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate HTML for winner payment request email
   */
  private generateWinnerPaymentRequestEmail(
    data: WinnerPaymentRequestEmailData
  ): string {
    const baseStyles = this.getBaseEmailStyles();

    return `
      <html>
        <head>${baseStyles}</head>
        <body>
          <div class="email-container">
            <div class="header">
              <h1>🎉 Congratulations - Payment Required</h1>
              <p>You won the auction!</p>
            </div>

            <div class="content">
              <h2>Dear ${data.recipientName},</h2>

              <div class="winner-badge">
                🏆 WINNING BIDDER
              </div>

              <p>Congratulations! You are the winning bidder for auction <strong>${
                data.auctionCode
              }</strong>!</p>

              <div class="details-box" style="background-color: #fef5e7; border-left-color: #f39c12;">
                <h3>💰 Payment Breakdown</h3>
                <p><strong>Winning Bid Amount:</strong> ${
                  data.winningAmount
                } VND</p>
                <p><strong>Deposit Already Paid:</strong> -${
                  data.depositAlreadyPaid
                } VND</p>
                <p><strong>Dossier Fee:</strong> +${data.dossierFee} VND</p>
                <hr style="border: 1px solid #ddd; margin: 10px 0;" />
                <p><strong>Total Amount Due:</strong> <span style="color: #f39c12; font-size: 24px; font-weight: bold;">${
                  data.totalDue
                } VND</span></p>
                <p><strong>Payment Deadline:</strong> <span style="color: #e74c3c; font-weight: bold;">${data.paymentDeadline.toLocaleString()}</span></p>
              </div>

              <div class="details-box">
                <h3>📋 Auction Details</h3>
                <p><strong>Auction:</strong> ${data.auctionName}</p>
                <p><strong>Auction Code:</strong> ${data.auctionCode}</p>
              </div>

              <h3>⚠️ Important Instructions</h3>
              <ul>
                <li>Payment must be completed within <strong>7 days</strong> of auction end</li>
                <li>Contract will be ready for signature after payment confirmation</li>
                <li>Failure to pay by deadline will result in <strong>deposit forfeiture</strong></li>
                <li>Property may be offered to the second-highest bidder</li>
              </ul>

              <h3>📞 Next Steps</h3>
              <ol>
                <li>Complete payment using the button below</li>
                <li>Wait for payment verification (usually within 24 hours)</li>
                <li>Review and sign the contract</li>
                <li>Finalize property handover</li>
              </ol>

              <div class="footer">
                <p>Thank you for participating in our auction!</p>
                <p>Payment deadline: ${data.paymentDeadline.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate HTML for winner payment confirmed email
   */
  private generateWinnerPaymentConfirmedEmail(
    data: WinnerPaymentConfirmedEmailData
  ): string {
    const baseStyles = this.getBaseEmailStyles();

    return `
      <html>
        <head>${baseStyles}</head>
        <body>
          <div class="email-container">
            <div class="header">
              <h1>✅ Payment Confirmed - Contract Ready</h1>
              <p>Final steps to complete your purchase</p>
            </div>

            <div class="content">
              <h2>Dear ${data.recipientName},</h2>

              <div class="winner-badge" style="background-color: #48bb78;">
                ✅ PAYMENT VERIFIED
              </div>

              <p>Excellent! Your payment for auction <strong>${
                data.auctionCode
              }</strong> has been successfully verified.</p>

              <div class="details-box">
                <h3>💰 Payment Summary</h3>
                <p><strong>Total Amount Paid:</strong> <span style="color: #48bb78; font-size: 20px; font-weight: bold;">${
                  data.totalPaid
                } VND</span></p>
                <p><strong>Auction:</strong> ${data.auctionName}</p>
                <p><strong>Auction Code:</strong> ${data.auctionCode}</p>
              </div>

              ${
                data.contractReady
                  ? `
                <h3>📄 Contract Ready for Signature</h3>
                <p>Your contract is now ready for review and signature.</p>

                <a href="#" class="button">Review Contract</a>

                <h3>📞 Next Steps</h3>
                <ol>
                  <li>Review the contract carefully</li>
                  <li>Sign the contract electronically</li>
                  <li>Await seller's signature</li>
                  <li>Auctioneer will finalize the contract</li>
                  <li>Property handover arrangements will be made</li>
                </ol>

                <p><strong>Timeline:</strong> Final contract should be ready within 3-5 business days after both parties have signed.</p>
              `
                  : ''
              }

              <div class="footer">
                <p>Thank you for your prompt payment!</p>
                <p>If you have any questions, please contact our support team.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate HTML for payment failure email
   */
  private generatePaymentFailureEmail(data: PaymentFailureEmailData): string {
    const baseStyles = this.getBaseEmailStyles();
    const paymentTypeText =
      data.paymentType === 'deposit' ? 'Deposit Payment' : 'Winner Payment';

    return `
      <html>
        <head>${baseStyles}</head>
        <body>
          <div class="email-container">
            <div class="header" style="background-color: #e74c3c;">
              <h1>⚠️ Payment Failed</h1>
              <p>Action required to complete your payment</p>
            </div>

            <div class="content">
              <h2>Dear ${data.recipientName},</h2>

              <div class="details-box" style="background-color: #fef5e7; border-left-color: #e74c3c;">
                <h3>❌ Payment Unsuccessful</h3>
                <p>We were unable to process your <strong>${paymentTypeText}</strong> for auction <strong>${
      data.auctionCode
    }</strong>.</p>
                <p><strong>Attempted Amount:</strong> ${
                  data.attemptedAmount
                } VND</p>
                <p><strong>Reason:</strong> ${data.failureReason}</p>
              </div>

              <h3>🔄 What You Need to Do</h3>
              <p>Please retry your payment as soon as possible to avoid registration cancellation.</p>

              <a href="${
                data.retryUrl
              }" class="button" style="background-color: #e74c3c;">Retry Payment Now</a>

              <div class="details-box">
                <h3>⏰ Important Deadline</h3>
                <p><strong>Payment must be completed by:</strong> <span style="color: #e74c3c; font-weight: bold;">${data.deadline.toLocaleString()}</span></p>
                ${
                  data.paymentType === 'deposit'
                    ? `
                  <p>⚠️ If payment is not received by the deadline, your registration will be <strong>automatically cancelled</strong>.</p>
                `
                    : `
                  <p>⚠️ If payment is not received by the deadline, your <strong>deposit will be forfeited</strong> and the property may be offered to the second-highest bidder.</p>
                `
                }
              </div>

              <h3>💡 Common Issues</h3>
              <ul>
                <li>Insufficient funds in account</li>
                <li>Bank transaction limits exceeded</li>
                <li>Incorrect payment information</li>
                <li>Network or connection issues</li>
              </ul>

              <p>If you continue to experience issues, please contact our support team immediately.</p>

              <div class="footer">
                <p>Need help? Contact: support@auctionhub.com</p>
                <p>Payment deadline: ${data.deadline.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate HTML for payment deadline reminder email
   */
  private generatePaymentDeadlineReminderEmail(
    data: PaymentDeadlineReminderEmailData
  ): string {
    const baseStyles = this.getBaseEmailStyles();
    const paymentTypeText =
      data.paymentType === 'deposit' ? 'Deposit Payment' : 'Final Payment';
    const urgencyColor = data.daysRemaining <= 1 ? '#e74c3c' : '#f39c12';

    return `
      <html>
        <head>${baseStyles}</head>
        <body>
          <div class="email-container">
            <div class="header" style="background-color: ${urgencyColor};">
              <h1>⏰ Payment Deadline Reminder</h1>
              <p>${data.daysRemaining} day(s) remaining</p>
            </div>

            <div class="content">
              <h2>Dear ${data.recipientName},</h2>

              <div class="details-box" style="background-color: #fef5e7; border-left-color: ${urgencyColor};">
                <h3>⏰ Urgent: Payment Deadline Approaching</h3>
                <p>This is a reminder that your <strong>${paymentTypeText}</strong> for auction <strong>${
      data.auctionCode
    }</strong> is due soon.</p>
                <p><strong>Amount Due:</strong> <span style="font-size: 24px; font-weight: bold;">${
                  data.amountDue
                } VND</span></p>
                <p><strong>Deadline:</strong> <span style="color: ${urgencyColor}; font-weight: bold;">${data.deadline.toLocaleString()}</span></p>
                <p><strong>Time Remaining:</strong> <span style="color: ${urgencyColor}; font-weight: bold;">${
      data.daysRemaining
    } day(s)</span></p>
              </div>

              <a href="${
                data.paymentUrl
              }" class="button" style="background-color: ${urgencyColor};">Complete Payment Now</a>

              <div class="details-box">
                <h3>📋 Auction Details</h3>
                <p><strong>Auction:</strong> ${data.auctionName}</p>
                <p><strong>Auction Code:</strong> ${data.auctionCode}</p>
              </div>

              <h3>⚠️ Important Warning</h3>
              ${
                data.paymentType === 'deposit'
                  ? `
                <p>If payment is not received by the deadline, your registration will be <strong>automatically cancelled</strong> and you will not be able to participate in this auction.</p>
              `
                  : `
                <p>If payment is not received by the deadline:</p>
                <ul>
                  <li>Your deposit will be <strong>forfeited</strong></li>
                  <li>You will lose the right to purchase the property</li>
                  <li>The property may be offered to the second-highest bidder</li>
                </ul>
              `
              }

              <h3>📞 Need Help?</h3>
              <p>If you're experiencing difficulties with payment, please contact our support team immediately:</p>
              <ul>
                <li>Email: support@auctionhub.com</li>
                <li>Phone: [Your phone number]</li>
              </ul>

              <div class="footer">
                <p>Act now to avoid missing the deadline!</p>
                <p>Payment deadline: ${data.deadline.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate HTML for admin deposit notification email
   */
  private generateAdminDepositNotificationEmail(
    data: AdminDepositNotificationEmailData
  ): string {
    const baseStyles = this.getBaseEmailStyles();

    return `
      <html>
        <head>${baseStyles}</head>
        <body>
          <div class="email-container">
            <div class="header">
              <h1>🔔 New Deposit Payment Received</h1>
              <p>Action required: Final approval</p>
            </div>

            <div class="content">
              <h2>Dear ${data.adminName},</h2>

              <p>A new deposit payment has been received and verified. The registration is now ready for final approval.</p>

              <div class="details-box">
                <h3>👤 User Information</h3>
                <p><strong>Name:</strong> ${data.userName}</p>
                <p><strong>Email:</strong> ${data.userEmail}</p>
              </div>

              <div class="details-box">
                <h3>💰 Payment Information</h3>
                <p><strong>Deposit Amount:</strong> <span style="color: #48bb78; font-size: 20px; font-weight: bold;">${
                  data.depositAmount
                } VND</span></p>
                <p><strong>Payment Date:</strong> ${data.paidAt.toLocaleString()}</p>
              </div>

              <div class="details-box">
                <h3>📋 Auction Details</h3>
                <p><strong>Auction:</strong> ${data.auctionName}</p>
                <p><strong>Auction Code:</strong> ${data.auctionCode}</p>
                <p><strong>Registration ID:</strong> ${data.registrationId}</p>
              </div>

              <h3>📞 Action Required</h3>
              <p>Please review the registration and give final approval so the user can start bidding.</p>

              <a href="#" class="button">Review & Approve Registration</a>

              <div class="footer">
                <p>This is an automated notification from Auction Hub.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate HTML for admin winner payment notification email
   */
  private generateAdminWinnerPaymentNotificationEmail(
    data: AdminWinnerPaymentNotificationEmailData
  ): string {
    const baseStyles = this.getBaseEmailStyles();

    return `
      <html>
        <head>${baseStyles}</head>
        <body>
          <div class="email-container">
            <div class="header">
              <h1>💰 Winner Payment Confirmed</h1>
              <p>Contract ready for final signatures</p>
            </div>

            <div class="content">
              <h2>Dear ${data.adminName},</h2>

              <p>The winner has successfully completed their payment for the auction. The contract is now ready for final signatures.</p>

              <div class="details-box">
                <h3>👤 Buyer (Winner)</h3>
                <p><strong>Name:</strong> ${data.buyerName}</p>
                <p><strong>Email:</strong> ${data.buyerEmail}</p>
              </div>

              <div class="details-box">
                <h3>👤 Seller</h3>
                <p><strong>Name:</strong> ${data.sellerName}</p>
              </div>

              <div class="details-box">
                <h3>💰 Payment Information</h3>
                <p><strong>Total Paid:</strong> <span style="color: #48bb78; font-size: 20px; font-weight: bold;">${
                  data.totalPaid
                } VND</span></p>
                <p><strong>Payment Date:</strong> ${data.paidAt.toLocaleString()}</p>
                <div class="winner-badge" style="background-color: #48bb78;">
                  ✅ PAYMENT VERIFIED
                </div>
              </div>

              <div class="details-box">
                <h3>📋 Auction Details</h3>
                <p><strong>Auction:</strong> ${data.auctionName}</p>
                <p><strong>Auction Code:</strong> ${data.auctionCode}</p>
                <p><strong>Contract ID:</strong> ${data.contractId}</p>
              </div>

              <h3>📞 Next Steps</h3>
              <ul>
                <li>Winner reviews and signs the contract</li>
                <li>Seller reviews and signs the contract</li>
                <li>Auctioneer reviews and finalizes</li>
                <li>Final contract document generated</li>
              </ul>

              <a href="#" class="button">View Contract</a>

              <div class="footer">
                <p>This is an automated notification from Auction Hub.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate HTML for seller payment notification email
   */
  private generateSellerPaymentNotificationEmail(
    data: SellerPaymentNotificationEmailData
  ): string {
    const baseStyles = this.getBaseEmailStyles();

    return `
      <html>
        <head>${baseStyles}</head>
        <body>
          <div class="email-container">
            <div class="header">
              <h1>💰 Winner Payment Received</h1>
              <p>Contract ready for your signature</p>
            </div>

            <div class="content">
              <h2>Dear ${data.sellerName},</h2>

              <div class="winner-badge" style="background-color: #48bb78;">
                ✅ PAYMENT VERIFIED
              </div>

              <p>Great news! The winning bidder has completed the payment for auction <strong>${
                data.auctionCode
              }</strong>.</p>

              <div class="details-box">
                <h3>💰 Payment Summary</h3>
                <p><strong>Total Amount Paid:</strong> <span style="color: #48bb78; font-size: 20px; font-weight: bold;">${
                  data.totalPaid
                } VND</span></p>
                <p><strong>Buyer:</strong> ${data.buyerName}</p>
              </div>

              <div class="details-box">
                <h3>📋 Auction Details</h3>
                <p><strong>Auction:</strong> ${data.auctionName}</p>
                <p><strong>Auction Code:</strong> ${data.auctionCode}</p>
              </div>

              ${
                data.contractReady
                  ? `
                <h3>📄 Contract Ready for Signature</h3>
                <p>The contract is now ready for your review and signature.</p>

                <a href="#" class="button">Review & Sign Contract</a>

                <h3>📞 Next Steps</h3>
                <ol>
                  <li>Review the contract carefully</li>
                  <li>Sign the contract electronically</li>
                  <li>Auctioneer will finalize after both parties sign</li>
                  <li>Property handover arrangements will be made</li>
                </ol>
              `
                  : ''
              }

              <div class="footer">
                <p>Thank you for using Auction Hub!</p>
                <p>If you have any questions, please contact our support team.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}
