import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentService } from './payment.service';
import { PaymentType, PaymentMethod } from './dto/PaymentCreateRequest.dto';
import { PaymentStatus } from '../../generated';

/**
 * Payment Processing Service - Central Hub
 * Handles all payment processing logic for auction system
 */
@Injectable()
export class PaymentProcessingService {
  private readonly logger = new Logger(PaymentProcessingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
  ) {}

  /**
   * INTEGRATION POINT 1: Register-to-Bid Deposit Payment
   * Process deposit payment for auction registration (Tier 2 approval)
   */
  async processDepositPayment(
    userId: string,
    auctionId: string,
    registrationId: string,
    depositAmount: number,
  ) {
    try {
      this.logger.log(
        `Processing deposit payment for user ${userId}, auction ${auctionId}, registration ${registrationId}`,
      );

      // Validate registration exists and is in correct state
      const registration = await this.prisma.auctionParticipant.findUnique({
        where: { id: registrationId },
        include: {
          auction: {
            include: {
              auctionPolicy: {
                include: { depositConfig: true },
              },
            },
          },
        },
      });

      if (!registration) {
        throw new NotFoundException('Registration not found');
      }

      if (registration.userId !== userId) {
        throw new BadRequestException('Registration does not belong to user');
      }

      if (!registration.documentsVerifiedAt) {
        throw new BadRequestException(
          'Documents must be verified before deposit payment',
        );
      }

      if (registration.depositPaidAt) {
        throw new BadRequestException('Deposit already paid');
      }

      // Validate deposit amount matches policy
      const expectedDepositAmount = parseFloat(
        registration.auction.depositAmountRequired.toString(),
      );

      if (Math.abs(depositAmount - expectedDepositAmount) > 0.01) {
        throw new BadRequestException(
          `Deposit amount mismatch. Expected: ${expectedDepositAmount}, Received: ${depositAmount}`,
        );
      }

      // Create payment record
      const payment = await this.paymentService.createPayment(userId, {
        auctionId,
        registrationId,
        paymentType: PaymentType.deposit,
        amount: depositAmount,
        paymentMethod: PaymentMethod.bank_transfer,
      });

      this.logger.log(
        `Deposit payment created: ${payment.payment_id} for registration ${registrationId}`,
      );

      return {
        paymentId: payment.payment_id,
        amount: depositAmount,
        paymentUrl: payment.payment_url,
        qrCode: payment.qr_code,
        bankInfo: payment.bank_info,
        deadline: payment.payment_deadline,
        status: 'pending',
        message: 'Deposit payment initiated. Please complete payment within deadline.',
      };
    } catch (error) {
      this.logger.error(
        `Failed to process deposit payment for registration ${registrationId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Verify and confirm deposit payment
   * Called by register-to-bid service after payment completion
   */
  async verifyDepositPayment(paymentId: string, registrationId: string) {
    try {
      // Verify payment with Stripe
      const verification = await this.paymentService.verifyPayment(paymentId);

      if (verification.status !== 'paid') {
        throw new BadRequestException('Payment not completed');
      }

      // Update payment record in database
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
      });

      if (!payment) {
        throw new NotFoundException('Payment record not found');
      }

      if (payment.registrationId !== registrationId) {
        throw new BadRequestException('Payment does not match registration');
      }

      // Update payment status
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.completed,
          paidAt: new Date(),
        },
      });

      this.logger.log(`Deposit payment ${paymentId} verified and confirmed`);

      return {
        verified: true,
        paymentId,
        amount: verification.amount,
        status: 'completed',
      };
    } catch (error) {
      this.logger.error(`Failed to verify deposit payment ${paymentId}`, error);
      throw error;
    }
  }

  /**
   * INTEGRATION POINT 2: Auction Finalization - Winner Payment
   * Calculate final payment required from winner after auction ends
   */
  async calculateWinnerPayment(auctionId: string, winnerId: string) {
    try {
      this.logger.log(
        `Calculating winner payment for auction ${auctionId}, winner ${winnerId}`,
      );

      // Get auction with financial summary
      const auction = await this.prisma.auction.findUnique({
        where: { id: auctionId },
        include: {
          financialSummary: true,
          participants: {
            where: { userId: winnerId },
          },
        },
      });

      if (!auction) {
        throw new NotFoundException('Auction not found');
      }

      if (auction.status !== 'success') {
        throw new BadRequestException('Auction is not in success status');
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

      if (winningBid.participant.user.id !== winnerId) {
        throw new BadRequestException('User is not the winner');
      }

      const winningAmount = parseFloat(winningBid.amount.toString());

      // Get deposit already paid
      const depositPaid = auction.participants[0]?.depositAmount
        ? parseFloat(auction.participants[0].depositAmount.toString())
        : 0;

      // Calculate remaining amount to pay
      const remainingAmount = winningAmount - depositPaid;

      // Additional fees winner might need to pay (dossier fee if not paid yet)
      const dossierFee = auction.saleFee
        ? parseFloat(auction.saleFee.toString())
        : 0;

      const totalDue = remainingAmount + dossierFee;

      this.logger.log(
        `Winner payment calculated: Winning amount: ${winningAmount}, Deposit: ${depositPaid}, Remaining: ${totalDue}`,
      );

      return {
        auctionId,
        winnerId,
        winningAmount,
        depositPaid,
        dossierFee,
        remainingAmount,
        totalDue,
        breakdown: {
          winningBid: winningAmount,
          depositAlreadyPaid: depositPaid,
          dossierFee: dossierFee,
          totalAmountDue: totalDue,
        },
        paymentDeadline: this.calculatePaymentDeadline(auction.auctionEndAt),
      };
    } catch (error) {
      this.logger.error(
        `Failed to calculate winner payment for auction ${auctionId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Process winner's final payment
   */
  async processWinnerPayment(
    userId: string,
    auctionId: string,
    paymentAmount: number,
  ) {
    try {
      this.logger.log(
        `Processing winner payment for user ${userId}, auction ${auctionId}, amount ${paymentAmount}`,
      );

      // Calculate expected payment
      const paymentBreakdown = await this.calculateWinnerPayment(
        auctionId,
        userId,
      );

      // Validate amount
      if (Math.abs(paymentAmount - paymentBreakdown.totalDue) > 0.01) {
        throw new BadRequestException(
          `Payment amount mismatch. Expected: ${paymentBreakdown.totalDue}, Received: ${paymentAmount}`,
        );
      }

      // Create payment record
      const payment = await this.paymentService.createPayment(userId, {
        auctionId,
        registrationId: null,
        paymentType: PaymentType.winning_payment,
        amount: paymentAmount,
        paymentMethod: PaymentMethod.bank_transfer,
      });

      this.logger.log(
        `Winner payment created: ${payment.payment_id} for auction ${auctionId}`,
      );

      return {
        paymentId: payment.payment_id,
        amount: paymentAmount,
        breakdown: paymentBreakdown.breakdown,
        paymentUrl: payment.payment_url,
        qrCode: payment.qr_code,
        bankInfo: payment.bank_info,
        deadline: payment.payment_deadline,
        status: 'pending',
        message:
          'Final payment initiated. Contract will be generated upon payment completion.',
      };
    } catch (error) {
      this.logger.error(
        `Failed to process winner payment for auction ${auctionId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Verify winner payment and trigger contract generation
   */
  async verifyWinnerPayment(paymentId: string, auctionId: string) {
    try {
      // Verify payment with Stripe
      const verification = await this.paymentService.verifyPayment(paymentId);

      if (verification.status !== 'paid') {
        throw new BadRequestException('Payment not completed');
      }

      // Update payment record
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
      });

      if (!payment) {
        throw new NotFoundException('Payment record not found');
      }

      if (payment.auctionId !== auctionId) {
        throw new BadRequestException('Payment does not match auction');
      }

      // Update payment status
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.completed,
          paidAt: new Date(),
        },
      });

      // Update contract status to ready for signing
      const contract = await this.prisma.contract.findFirst({
        where: { auctionId },
      });

      if (contract) {
        await this.prisma.contract.update({
          where: { id: contract.id },
          data: {
            status: 'signed', // Ready for final signatures
          },
        });

        this.logger.log(
          `Winner payment verified. Contract ${contract.id} ready for signing`,
        );
      }

      return {
        verified: true,
        paymentId,
        amount: verification.amount,
        status: 'completed',
        contractReady: !!contract,
        contractId: contract?.id,
        message: 'Payment completed. Contract is ready for final signatures.',
      };
    } catch (error) {
      this.logger.error(`Failed to verify winner payment ${paymentId}`, error);
      throw error;
    }
  }

  /**
   * Get payment status for registration
   */
  async getDepositPaymentStatus(registrationId: string) {
    const payments = await this.prisma.payment.findMany({
      where: {
        registrationId,
        paymentType: PaymentType.deposit,
      },
      orderBy: { createdAt: 'desc' },
    });

    return payments.map((p) => ({
      paymentId: p.id,
      amount: parseFloat(p.amount.toString()),
      status: p.status,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
    }));
  }

  /**
   * Get payment status for auction winner
   */
  async getWinnerPaymentStatus(auctionId: string, winnerId: string) {
    const payments = await this.prisma.payment.findMany({
      where: {
        auctionId,
        userId: winnerId,
        paymentType: PaymentType.winning_payment,
      },
      orderBy: { createdAt: 'desc' },
    });

    return payments.map((p) => ({
      paymentId: p.id,
      amount: parseFloat(p.amount.toString()),
      status: p.status,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
    }));
  }

  /**
   * Process refund for deposit
   */
  async refundDeposit(
    registrationId: string,
    reason: string,
    refundedBy: string,
  ) {
    try {
      this.logger.log(
        `Processing deposit refund for registration ${registrationId}`,
      );

      // Find deposit payment
      const depositPayment = await this.prisma.payment.findFirst({
        where: {
          registrationId,
          paymentType: PaymentType.deposit,
          status: PaymentStatus.completed,
        },
      });

      if (!depositPayment) {
        throw new NotFoundException('No completed deposit payment found');
      }

      // Create refund record
      const refund = await this.prisma.payment.create({
        data: {
          userId: depositPayment.userId,
          auctionId: depositPayment.auctionId,
          registrationId,
          paymentType: PaymentType.refund,
          amount: depositPayment.amount,
          currency: depositPayment.currency,
          status: PaymentStatus.completed,
          refundedAt: new Date(),
          refundReason: reason,
        },
      });

      // Update original payment
      await this.prisma.payment.update({
        where: { id: depositPayment.id },
        data: {
          status: PaymentStatus.refunded,
          refundedAt: new Date(),
          refundReason: reason,
        },
      });

      this.logger.log(`Deposit refunded for registration ${registrationId}`);

      return {
        success: true,
        refundId: refund.id,
        amount: parseFloat(refund.amount.toString()),
        reason,
      };
    } catch (error) {
      this.logger.error(
        `Failed to refund deposit for registration ${registrationId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Calculate payment deadline (e.g., 7 days after auction end)
   */
  private calculatePaymentDeadline(auctionEndDate: Date): Date {
    const deadline = new Date(auctionEndDate);
    deadline.setDate(deadline.getDate() + 7); // 7 days to pay
    return deadline;
  }
}
