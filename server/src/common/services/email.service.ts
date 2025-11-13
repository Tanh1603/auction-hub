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
}
