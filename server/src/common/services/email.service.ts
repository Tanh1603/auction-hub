import { Injectable, Logger } from '@nestjs/common';

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

  /**
   * Send auction results email to participant
   * TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
   */
  async sendAuctionResultEmail(data: AuctionResultEmailData): Promise<void> {
    try {
      // For now, we'll log the email content
      // In production, integrate with actual email service
      const emailContent = this.generateAuctionResultEmail(data);

      this.logger.log(`
        ========================================
        EMAIL TO: ${data.recipientEmail}
        SUBJECT: Auction Results - ${data.auctionCode}
        ========================================
        ${emailContent}
        ========================================
      `);

      // TODO: Replace with actual email sending logic
      // Example with SendGrid:
      // await this.sendGridService.send({
      //   to: data.recipientEmail,
      //   from: 'noreply@auctionhub.com',
      //   subject: `Auction Results - ${data.auctionCode}`,
      //   html: emailContent,
      // });

    } catch (error) {
      this.logger.error(`Failed to send auction result email to ${data.recipientEmail}`, error);
      // Don't throw - email failure shouldn't break the auction finalization
    }
  }

  /**
   * Generate HTML email content for auction results
   */
  private generateAuctionResultEmail(data: AuctionResultEmailData): string {
    if (data.isWinner) {
      return `
        <html>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #2c5282;">Congratulations, ${data.recipientName}!</h2>
            <p>You are the winning bidder for auction <strong>${data.auctionCode}</strong>.</p>

            <div style="background-color: #f7fafc; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="color: #2d3748;">Auction Details</h3>
              <p><strong>Auction:</strong> ${data.auctionName}</p>
              <p><strong>Your Winning Bid:</strong> $${data.winningAmount}</p>
              <p><strong>Total Bids:</strong> ${data.totalBids}</p>
            </div>

            <p>Our team will contact you shortly to complete the paperwork and arrange payment.</p>

            <p style="color: #718096; font-size: 14px; margin-top: 30px;">
              Thank you for participating in this auction.
            </p>
          </body>
        </html>
      `;
    } else {
      return `
        <html>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #2c5282;">Auction Results - ${data.auctionCode}</h2>
            <p>Dear ${data.recipientName},</p>
            <p>Thank you for participating in auction <strong>${data.auctionCode}</strong>.</p>

            <div style="background-color: #f7fafc; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="color: #2d3748;">Auction Details</h3>
              <p><strong>Auction:</strong> ${data.auctionName}</p>
              <p><strong>Winning Bidder:</strong> ${data.winnerName || 'No winner'}</p>
              <p><strong>Winning Amount:</strong> ${data.winningAmount ? `$${data.winningAmount}` : 'N/A'}</p>
              <p><strong>Total Bids:</strong> ${data.totalBids}</p>
            </div>

            <p>Unfortunately, you were not the winning bidder this time.</p>
            <p>We hope to see you at our future auctions.</p>

            <p style="color: #718096; font-size: 14px; margin-top: 30px;">
              Thank you for your participation.
            </p>
          </body>
        </html>
      `;
    }
  }

  /**
   * Send bulk auction result emails to all participants
   */
  async sendBulkAuctionResultEmails(emails: AuctionResultEmailData[]): Promise<void> {
    const promises = emails.map(emailData => this.sendAuctionResultEmail(emailData));
    await Promise.allSettled(promises);
  }
}
