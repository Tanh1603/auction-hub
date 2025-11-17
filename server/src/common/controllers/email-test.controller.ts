import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Param,
  Query,
} from '@nestjs/common';
import { EmailService } from '../services/email.service';
import { EmailTemplateService } from '../email/email-template.service';
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
  constructor(
    private readonly emailService: EmailService,
    private readonly templateService: EmailTemplateService
  ) {}

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

  /**
   * Preview an email template in the browser
   * GET /email-test/preview/:templatePath
   * Example: /email-test/preview/auction-results/winner
   */
  @Get('preview/:category/:name')
  async previewTemplate(
    @Param('category') category: string,
    @Param('name') name: string
  ) {
    const templatePath = `${category}/${name}`;
    const mockData = this.getMockDataForTemplate(templatePath);
    const subject = this.templateService.getSubject(templatePath, mockData);
    const html = await this.templateService.render(
      templatePath,
      mockData,
      subject
    );
    return html;
  }

  /**
   * List all available email templates
   * GET /email-test/templates
   */
  @Get('templates')
  async listTemplates() {
    const templates = await this.templateService.listTemplates();
    return {
      count: templates.length,
      templates: templates.map((t) => ({
        path: t,
        previewUrl: `/email-test/preview/${t.replace('/', '/')}`,
      })),
    };
  }

  /**
   * Get mock data for a specific template
   */
  private getMockDataForTemplate(templatePath: string): any {
    const baseMockData = {
      recipientEmail: 'user@example.com',
      recipientName: 'John Doe',
      auctionCode: 'TEST-2025-001',
      auctionName: 'Luxury Apartment in Downtown - Mock Data',
    };

    const mockDataMap: Record<string, any> = {
      'auction-results/winner': {
        ...baseMockData,
        isWinner: true,
        winningAmount: '250000',
        totalBids: 15,
      },
      'auction-results/non-winner': {
        ...baseMockData,
        isWinner: false,
        winningAmount: '250000',
        winnerName: 'Jane Smith',
        totalBids: 15,
      },
      'registration/documents-verified': {
        ...baseMockData,
        nextStep: 'pay_deposit',
        depositAmount: '50000',
        paymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      'registration/deposit-payment-request': {
        ...baseMockData,
        depositAmount: '50000',
        paymentUrl: '#',
        qrCode: 'https://via.placeholder.com/200',
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      'registration/deposit-confirmed': {
        ...baseMockData,
        depositAmount: '50000',
        paidAt: new Date(),
        awaitingApproval: true,
      },
      'registration/final-approval': {
        ...baseMockData,
        auctionStartAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        canNowBid: true,
      },
      'payments/winner-payment-request': {
        ...baseMockData,
        winningAmount: '250000',
        depositAlreadyPaid: '50000',
        dossierFee: '5000',
        totalDue: '205000',
        paymentDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      'payments/winner-payment-confirmed': {
        ...baseMockData,
        totalPaid: '205000',
        contractReady: true,
      },
      'payments/payment-failure': {
        ...baseMockData,
        paymentType: 'deposit',
        attemptedAmount: '50000',
        failureReason: 'Insufficient funds',
        retryUrl: '#',
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      'payments/payment-reminder': {
        ...baseMockData,
        paymentType: 'deposit',
        amountDue: '50000',
        deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        daysRemaining: 2,
        paymentUrl: '#',
      },
      'admin/deposit-notification': {
        ...baseMockData,
        adminName: 'Admin User',
        userName: 'John Doe',
        userEmail: 'user@example.com',
        depositAmount: '50000',
        paidAt: new Date(),
        registrationId: 'REG-123456',
      },
      'admin/seller-payment-notification': {
        ...baseMockData,
        sellerName: 'Property Owner',
        buyerName: 'John Doe',
        totalPaid: '205000',
        contractReady: true,
      },
      'admin/winner-payment-notification': {
        ...baseMockData,
        adminName: 'Admin User',
        buyerName: 'John Doe',
        buyerEmail: 'buyer@example.com',
        sellerName: 'Property Owner',
        totalPaid: '205000',
        paidAt: new Date(),
        contractId: 'CONTRACT-123456',
      },
    };

    return mockDataMap[templatePath] || baseMockData;
  }
}
