import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { EmailService } from '../services/email.service';
import { AuthGuard } from '../guards/auth.guard';
import {
  CurrentUser,
  CurrentUserData,
} from '../decorators/current-user.decorator';

export interface SendTestEmailDto {
  recipientEmail: string;
}

@Controller('email-test')
export class EmailTestController {
  constructor(private readonly emailService: EmailService) {}

  /**
   * Send a test email to verify SMTP configuration
   * POST /email-test/send
   */
  @Post('send')
  // @UseGuards(AuthGuard)
  async sendTestEmail(
    @Body() dto: SendTestEmailDto
    // , @CurrentUser() user: CurrentUserData
  ) {
    const success = await this.emailService.sendTestEmail(dto.recipientEmail);

    return {
      success,
      message: success
        ? 'Test email sent successfully'
        : 'Failed to send test email - check SMTP configuration',
      recipientEmail: dto.recipientEmail,
      // testedBy: user.email,
      testedAt: new Date(),
    };
  }

  /**
   * Get email service configuration status
   * GET /email-test/status
   */
  @Get('status')
  // @UseGuards(AuthGuard)
  async getEmailServiceStatus(/* @CurrentUser() user: CurrentUserData */) {
    const status = this.emailService.getEmailServiceStatus();

    return {
      ...status,
      // checkedBy: user.email,
      checkedAt: new Date(),
    };
  }

  /**
   * Send sample auction result emails for testing
   * POST /email-test/auction-sample
   */
  @Post('auction-sample')
  // @UseGuards(AuthGuard)
  async sendSampleAuctionEmails(
    @Body() dto: SendTestEmailDto
    // , @CurrentUser() user: CurrentUserData
  ) {
    // Send winner email
    await this.emailService.sendAuctionResultEmail({
      recipientEmail: dto.recipientEmail,
      recipientName: 'Test User',
      auctionCode: 'TEST-001',
      auctionName: 'Sample Test Auction - Beautiful Apartment',
      isWinner: true,
      winningAmount: '250000',
      winnerName: 'Test User',
      totalBids: 15,
    });

    // Send non-winner email to same address (for testing)
    await this.emailService.sendAuctionResultEmail({
      recipientEmail: dto.recipientEmail,
      recipientName: 'Test User',
      auctionCode: 'TEST-002',
      auctionName: 'Sample Test Auction - Luxury Villa',
      isWinner: false,
      winningAmount: '500000',
      winnerName: 'John Smith',
      totalBids: 23,
    });

    return {
      success: true,
      message:
        'Sample auction result emails sent (both winner and non-winner versions)',
      recipientEmail: dto.recipientEmail,
      samplesCount: 2,
      // sentBy: user.email,
      sentAt: new Date(),
    };
  }
}
