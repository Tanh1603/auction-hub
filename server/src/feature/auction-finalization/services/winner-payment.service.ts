import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../../common/services/email.service';
import { PaymentService } from '../../../payment/payment.service';
import {
  PaymentType,
  PaymentMethod,
} from '../../../payment/dto/PaymentCreateRequest.dto';
import { AuctionStatus, ContractStatus } from '../../../../generated';

/**
 * Service responsible for winner payment operations
 * Context: Auction Winner
 */
@Injectable()
export class WinnerPaymentService {
  private readonly logger = new Logger(WinnerPaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly paymentService: PaymentService
  ) {}

  /**
   * Get winner payment requirements
   * Called after auction finalization to emit payment details to winner
   */
  async getWinnerPaymentRequirements(auctionId: string) {
    try {
      this.logger.log(
        `Getting winner payment requirements for auction ${auctionId}`
      );

      // Get auction with financial summary (already calculated during finalization)
      const auction = await this.prisma.auction.findUnique({
        where: { id: auctionId },
        include: {
          participants: true,
        },
      });

      if (!auction) {
        throw new NotFoundException('Auction not found');
      }

      if (auction.status !== AuctionStatus.success) {
        throw new BadRequestException(
          'Auction must be successful to get payment requirements'
        );
      }

      // Get winning bid
      const winningBid = await this.prisma.auctionBid.findFirst({
        where: {
          auctionId,
          isWinningBid: true,
        },
        include: {
          participant: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!winningBid) {
        throw new NotFoundException('Winning bid not found');
      }

      // Calculate payment breakdown from existing data
      const winningAmount = parseFloat(winningBid.amount.toString());
      const depositPaid = winningBid.participant.depositAmount
        ? parseFloat(winningBid.participant.depositAmount.toString())
        : 0;
      const dossierFee = auction.saleFee
        ? parseFloat(auction.saleFee.toString())
        : 0;

      const remainingAmount = winningAmount - depositPaid;
      const totalDue = remainingAmount + dossierFee;

      // Calculate payment deadline (e.g., 7 days after auction end)
      const paymentDeadline = new Date(auction.auctionEndAt);
      paymentDeadline.setDate(paymentDeadline.getDate() + 7);

      this.logger.log(
        `Winner payment requirements: Total due ${totalDue} for auction ${auctionId}`
      );

      // Send email notification to winner with payment requirements
      await this.emailService.sendWinnerPaymentRequestEmail({
        recipientEmail: winningBid.participant.user.email,
        recipientName: winningBid.participant.user.fullName,
        auctionCode: auction.code,
        auctionName: auction.name,
        winningAmount: winningAmount.toLocaleString(),
        depositAlreadyPaid: depositPaid.toLocaleString(),
        dossierFee: dossierFee.toLocaleString(),
        totalDue: totalDue.toLocaleString(),
        paymentDeadline: paymentDeadline,
      });

      this.logger.log(
        `Winner payment request email sent to ${winningBid.participant.user.email} for auction ${auctionId}`
      );

      return {
        auctionId,
        winner: {
          userId: winningBid.participant.userId,
          fullName: winningBid.participant.user.fullName,
          email: winningBid.participant.user.email,
        },
        paymentBreakdown: {
          winningAmount,
          depositAlreadyPaid: depositPaid,
          dossierFee,
          remainingAmount,
          totalDue,
          paymentDeadline: paymentDeadline.toISOString(),
        },
        financialSummary: auction.netAmountToPropertyOwner
          ? {
              netAmountToSeller: parseFloat(
                auction.netAmountToPropertyOwner.toString()
              ),
              totalCommission: parseFloat(
                auction.commissionFee?.toString() || '0'
              ),
              totalCosts: parseFloat(
                auction.totalAuctionCosts?.toString() || '0'
              ),
            }
          : null,
        message:
          'Congratulations! Please complete the payment within the deadline to finalize your purchase.',
      };
    } catch (error) {
      this.logger.error(
        `Failed to get winner payment requirements for auction ${auctionId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Initiate winner payment
   * Winner initiates payment after seeing requirements
   */
  async initiateWinnerPayment(auctionId: string, winnerId: string) {
    try {
      this.logger.log(
        `Initiating winner payment for auction ${auctionId}, winner ${winnerId}`
      );

      // Get payment requirements (reuse existing logic)
      const requirements = await this.getWinnerPaymentRequirements(auctionId);

      // Verify user is the winner
      if (requirements.winner.userId !== winnerId) {
        throw new ForbiddenException('Only the winner can initiate payment');
      }

      // Directly invoke PaymentService.createPayment()
      const paymentInfo = await this.paymentService.createPayment(winnerId, {
        auctionId,
        registrationId: null,
        paymentType: PaymentType.winning_payment,
        amount: requirements.paymentBreakdown.totalDue,
        paymentMethod: PaymentMethod.bank_transfer,
      });

      this.logger.log(
        `Winner payment created: ${paymentInfo.payment_id} for auction ${auctionId}. Amount: ${requirements.paymentBreakdown.totalDue}`
      );

      return {
        paymentId: paymentInfo.payment_id,
        amount: requirements.paymentBreakdown.totalDue,
        breakdown: requirements.paymentBreakdown,
        paymentUrl: paymentInfo.payment_url,
        qrCode: paymentInfo.qr_code,
        bankInfo: paymentInfo.bank_info,
        deadline: paymentInfo.payment_deadline,
        message:
          'Please complete payment to finalize the contract. Contract will be ready for signatures after payment confirmation.',
      };
    } catch (error) {
      this.logger.error(
        `Failed to initiate winner payment for auction ${auctionId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Verify winner payment and prepare contract
   * Called after winner completes payment
   */
  async verifyWinnerPaymentAndPrepareContract(
    sessionId: string,
    auctionId: string
  ) {
    try {
      this.logger.log(
        `Verifying winner payment session ${sessionId} for auction ${auctionId}`
      );

      // Step 1: Verify payment with Stripe via PaymentService
      const verification = await this.paymentService.verifyPayment(sessionId);

      // Find the payment record using Stripe session ID (stored in transactionId)
      const payment = await this.prisma.payment.findFirst({
        where: {
          transactionId: sessionId,
          auctionId: auctionId,
          paymentType: 'winning_payment',
        },
      });

      if (!payment) {
        throw new NotFoundException(
          'Payment record not found for this session'
        );
      }

      if (verification.status !== 'paid') {
        this.logger.warn(
          `Payment session ${sessionId} verification failed. Status: ${verification.status}`
        );

        // Handle payment failure with fallback to 2nd bidder if deadline expired
        await this.handlePaymentFailure(
          auctionId,
          payment.id,
          sessionId,
          verification.status
        );

        throw new BadRequestException(
          `Payment not completed. Status: ${verification.status}. Please retry payment before the deadline.`
        );
      }

      // Step 2: Update payment record in database
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'completed',
          paidAt: new Date(),
        },
      });

      // Step 3: Update contract status (draft → signed, ready for final signatures)
      const contract = await this.prisma.contract.findFirst({
        where: { auctionId },
        include: {
          auction: true,
          propertyOwner: true,
          buyer: true,
        },
      });

      if (!contract) {
        throw new NotFoundException('Contract not found for this auction');
      }

      await this.prisma.contract.update({
        where: { id: contract.id },
        data: {
          status: ContractStatus.signed, // Ready for final signatures
        },
      });

      this.logger.log(
        `Winner payment ${sessionId} (ID: ${payment.id}) verified. Contract ${contract.id} ready for signatures.`
      );

      // Send notifications
      await this.sendPaymentConfirmationEmails(contract, verification.amount);

      // Return contract data for contract generation module
      return {
        success: true,
        paymentVerified: true,
        paymentId: payment.id,
        sessionId: sessionId,
        amount: verification.amount,
        contractId: contract.id,
        contractStatus: 'signed',
        contractReady: true,
        message:
          'Payment verified successfully. Contract is ready for final signatures from both parties.',
        nextSteps: [
          '1. Winner reviews and signs the contract',
          '2. Seller reviews and signs the contract',
          '3. Auctioneer reviews and finalizes',
          '4. Final contract document generated',
        ],
        contractData: {
          auctionId,
          contractId: contract.id,
          seller: {
            userId: contract.propertyOwnerUserId,
            fullName: contract.propertyOwner.fullName,
            email: contract.propertyOwner.email,
          },
          buyer: {
            userId: contract.buyerUserId,
            fullName: contract.buyer.fullName,
            email: contract.buyer.email,
          },
          auctionDetails: {
            title: contract.auction.name,
            startingPrice: parseFloat(
              contract.auction.startingPrice.toString()
            ),
            finalPrice: parseFloat(contract.price.toString()),
          },
          paymentConfirmed: true,
          paymentDate: new Date(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to verify winner payment for auction ${auctionId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Verify winner payment (wrapper for session-based verification)
   * Finds payment by Stripe session ID and verifies it
   */
  async verifyWinnerPayment(
    sessionId: string,
    auctionId: string,
    userId: string
  ) {
    try {
      this.logger.log(
        `Verifying winner payment with session ${sessionId} for auction ${auctionId}`
      );

      // Verify payment with Stripe first
      const verification = await this.paymentService.verifyPayment(sessionId);

      if (verification.status !== 'paid') {
        throw new BadRequestException('Payment not completed yet');
      }

      // Find the payment record by transaction ID (Stripe session ID)
      const payment = await this.prisma.payment.findFirst({
        where: {
          transactionId: sessionId,
          auctionId: auctionId,
          paymentType: 'winning_payment',
        },
      });

      if (!payment) {
        throw new NotFoundException('Payment record not found');
      }

      // Verify the user is authorized (winner or admin/auctioneer)
      const winningBid = await this.prisma.auctionBid.findFirst({
        where: {
          auctionId,
          isWinningBid: true,
        },
        include: {
          participant: true,
        },
      });

      if (!winningBid) {
        throw new NotFoundException('No winning bid found for this auction');
      }

      // Get user to check role
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Allow winner OR admin/auctioneer to verify payment
      const isWinner = winningBid.participant.userId === userId;
      const isAdmin = ['admin', 'auctioneer', 'super_admin'].includes(
        user.role
      );

      if (!isWinner && !isAdmin) {
        throw new ForbiddenException(
          'Only the winner or an admin can verify this payment'
        );
      }

      // Call the existing verification method
      return this.verifyWinnerPaymentAndPrepareContract(sessionId, auctionId);
    } catch (error) {
      this.logger.error(
        `Failed to verify winner payment for auction ${auctionId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Handle payment failure and potentially offer to 2nd bidder
   */
  private async handlePaymentFailure(
    auctionId: string,
    paymentId: string,
    sessionId: string,
    failureStatus: string
  ) {
    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        bids: {
          where: { isWinningBid: true },
          include: {
            participant: {
              include: { user: true },
            },
          },
        },
      },
    });

    if (!auction || auction.bids.length === 0) {
      return;
    }

    const winningBid = auction.bids[0];

    // Calculate payment deadline (7 days after auction end)
    const paymentDeadline = new Date(auction.auctionEndAt);
    paymentDeadline.setDate(paymentDeadline.getDate() + 7);
    const now = new Date();

    // Check if deadline has passed
    if (now > paymentDeadline) {
      await this.forfeitDepositAndOfferToSecondBidder(auction, winningBid);
    } else {
      // Send failure notification
      await this.sendPaymentFailureNotification(
        auction,
        winningBid,
        failureStatus,
        paymentDeadline,
        paymentId
      );
    }
  }

  /**
   * Forfeit deposit and offer auction to 2nd highest bidder
   */
  private async forfeitDepositAndOfferToSecondBidder(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auction: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    winningBid: any
  ) {
    this.logger.error(
      `Winner payment deadline expired for auction ${auction.id}. Forfeiting deposit and offering to 2nd bidder.`
    );

    // Mark winning bid as forfeited
    await this.prisma.auctionBid.update({
      where: { id: winningBid.id },
      data: { isWinningBid: false },
    });

    // Get 2nd highest bid
    const secondHighestBid = await this.prisma.auctionBid.findFirst({
      where: {
        auctionId: auction.id,
        isDenied: false,
        isWithdrawn: false,
        id: { not: winningBid.id },
      },
      orderBy: { amount: 'desc' },
      include: {
        participant: {
          include: { user: true },
        },
      },
    });

    if (secondHighestBid) {
      // Offer to 2nd highest bidder
      await this.prisma.auctionBid.update({
        where: { id: secondHighestBid.id },
        data: { isWinningBid: true },
      });

      // Send notification to new winner
      const requirements = await this.getWinnerPaymentRequirements(auction.id);
      await this.emailService.sendWinnerPaymentRequestEmail({
        recipientEmail: secondHighestBid.participant.user.email,
        recipientName: secondHighestBid.participant.user.fullName,
        auctionCode: auction.code,
        auctionName: auction.name,
        winningAmount:
          requirements.paymentBreakdown.winningAmount.toLocaleString(),
        depositAlreadyPaid:
          requirements.paymentBreakdown.depositAlreadyPaid.toLocaleString(),
        dossierFee: requirements.paymentBreakdown.dossierFee.toLocaleString(),
        totalDue: requirements.paymentBreakdown.totalDue.toLocaleString(),
        paymentDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      this.logger.log(
        `Auction ${auction.id} offered to 2nd highest bidder ${secondHighestBid.participant.user.email}`
      );
    } else {
      // No 2nd bidder - mark auction as failed
      await this.prisma.auction.update({
        where: { id: auction.id },
        data: { status: AuctionStatus.no_bid },
      });

      this.logger.warn(
        `No 2nd bidder available for auction ${auction.id}. Auction marked as no_bid.`
      );
    }
  }

  /**
   * Send payment failure notification email
   */
  private async sendPaymentFailureNotification(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auction: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    winningBid: any,
    failureStatus: string,
    paymentDeadline: Date,
    paymentId: string
  ) {
    const totalDue = await this.getWinnerPaymentRequirements(auction.id);

    await this.emailService.sendPaymentFailureEmail({
      recipientEmail: winningBid.participant.user.email,
      recipientName: winningBid.participant.user.fullName,
      auctionCode: auction.code,
      auctionName: auction.name,
      paymentType: 'winning_payment',
      attemptedAmount: totalDue.paymentBreakdown.totalDue.toLocaleString(),
      failureReason: this.getPaymentFailureReason(failureStatus),
      retryUrl: `${process.env.FRONTEND_URL}/auctions/${auction.id}/winner-payment/retry?paymentId=${paymentId}`,
      deadline: paymentDeadline,
    });

    // Track payment attempt
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'failed' },
    });
  }

  /**
   * Send payment confirmation emails to all parties
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async sendPaymentConfirmationEmails(contract: any, amount: number) {
    // Send email notification to winner
    await this.emailService.sendWinnerPaymentConfirmedEmail({
      recipientEmail: contract.buyer.email,
      recipientName: contract.buyer.fullName,
      auctionCode: contract.auction.code,
      auctionName: contract.auction.name,
      totalPaid: amount.toLocaleString(),
      contractReady: true,
    });

    // Send notification to seller
    await this.emailService.sendSellerPaymentNotificationEmail({
      recipientEmail: contract.seller.email,
      sellerName: contract.seller.fullName,
      buyerName: contract.buyer.fullName,
      auctionCode: contract.auction.code,
      auctionName: contract.auction.name,
      totalPaid: amount.toLocaleString(),
      contractReady: true,
    });

    // Send notification to admin(s)/auctioneer(s)
    const adminUsers = await this.prisma.user.findMany({
      where: {
        role: { in: ['admin', 'auctioneer'] },
        isBanned: false,
        deletedAt: null,
      },
    });

    const adminNotificationPromises = adminUsers.map((admin) =>
      this.emailService.sendAdminWinnerPaymentNotificationEmail({
        recipientEmail: admin.email,
        adminName: admin.fullName,
        buyerName: contract.buyer.fullName,
        buyerEmail: contract.buyer.email,
        sellerName: contract.seller.fullName,
        auctionCode: contract.auction.code,
        auctionName: contract.auction.name,
        totalPaid: amount.toLocaleString(),
        paidAt: new Date(),
        contractId: contract.id,
      })
    );

    await Promise.allSettled(adminNotificationPromises).catch((err) => {
      this.logger.error(
        'Error sending admin winner payment notifications:',
        err
      );
    });

    this.logger.log(
      `Email notifications sent: winner, seller, and ${adminUsers.length} admin(s) notified`
    );
  }

  /**
   * Helper method to get user-friendly payment failure reason
   */
  private getPaymentFailureReason(status: string): string {
    const reasonMap: Record<string, string> = {
      failed:
        'Payment processing failed. Please check your payment method and try again.',
      cancelled:
        'Payment was cancelled. Please retry to complete your purchase.',
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
}
