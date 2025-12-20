/**
 * RefundService - Core service for deposit refund management
 * Handles eligibility evaluation, refund requests, and processing
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { EmailService } from '../../../../common/services/email.service';
import { PaymentProcessingService } from '../../../../payment/payment-processing.service';

/**
 * Disqualification reasons enum - matches business rules
 */
export enum DisqualificationReason {
  NO_SHOW = 'NO_SHOW', // Paid deposit but didn't attend auction
  FALSE_INFORMATION = 'FALSE_INFORMATION',
  FORGED_DOCUMENTS = 'FORGED_DOCUMENTS',
  PRICE_RIGGING = 'PRICE_RIGGING',
  AUCTION_OBSTRUCTION = 'AUCTION_OBSTRUCTION',
  BID_WITHDRAWAL = 'BID_WITHDRAWAL',
  REFUSED_TO_SIGN = 'REFUSED_TO_SIGN',
  REFUSED_RESULT = 'REFUSED_RESULT',
  PAYMENT_DEFAULT = 'PAYMENT_DEFAULT',
  CONTRACT_DEFAULT = 'CONTRACT_DEFAULT',
  CHECK_IN_FAILURE = 'CHECK_IN_FAILURE',
  LATE_WITHDRAWAL = 'LATE_WITHDRAWAL', // Withdrew after saleEndAt deadline
}

/**
 * Refund status enum
 */
export enum RefundStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PROCESSED = 'processed',
  AUTO_PROCESSED = 'auto_processed', // Automatically processed by scheduled job
  FORFEITED = 'forfeited',
}

export interface RefundEligibility {
  eligible: boolean;
  reason: string;
  depositAmount: number | null;
}

export interface RefundDetailDto {
  participant: {
    id: string;
    userId: string;
    auctionId: string;
    user: { email: string; fullName: string };
    auction: { code: string; name: string };
  };
  deposit: {
    amount: number | null;
    paidAt: Date | null;
  };
  refund: {
    status: string | null;
    requestedAt: Date | null;
    processedAt: Date | null;
  };
  eligibility: RefundEligibility;
  disqualification: {
    isDisqualified: boolean;
    reason: string | null;
    disqualifiedAt: Date | null;
  };
}

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly paymentService: PaymentProcessingService
  ) {}

  /**
   * Evaluate refund eligibility for a participant
   * Implements all business rules for Vietnamese auction regulations
   */
  async evaluateRefundEligibility(
    participantId: string
  ): Promise<RefundEligibility> {
    const participant = await this.prisma.auctionParticipant.findUnique({
      where: { id: participantId },
      include: {
        auction: true,
        bids: { where: { isWinningBid: true } },
      },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    // Rule 1: Disqualified participants NOT eligible
    if (participant.isDisqualified) {
      return {
        eligible: false,
        reason: `Disqualified: ${
          participant.disqualifiedReason || 'Violation of auction regulations'
        }`,
        depositAmount: participant.depositAmount
          ? parseFloat(participant.depositAmount.toString())
          : null,
      };
    }

    // Rule 2: Winners NOT eligible (must complete purchase)
    const hasWinningBid = participant.bids.some((bid) => bid.isWinningBid);
    if (hasWinningBid) {
      return {
        eligible: false,
        reason:
          'Winner must complete purchase - deposit applied to winning amount',
        depositAmount: participant.depositAmount
          ? parseFloat(participant.depositAmount.toString())
          : null,
      };
    }

    // Rule 3: Check-in failure NOT eligible (confirmed but didn't check in after auction ended)
    const auctionEnded = new Date() > participant.auction.auctionEndAt;
    if (participant.confirmedAt && !participant.checkedInAt && auctionEnded) {
      return {
        eligible: false,
        reason: 'Failed to check in for auction - deposit forfeited',
        depositAmount: participant.depositAmount
          ? parseFloat(participant.depositAmount.toString())
          : null,
      };
    }

    // Rule 4: Late withdrawal NOT eligible (withdrew after deadline)
    if (participant.withdrawnAt) {
      const withdrawalDeadline = participant.auction.saleEndAt;
      if (participant.withdrawnAt > withdrawalDeadline) {
        return {
          eligible: false,
          reason: 'Withdrew after deadline - deposit forfeited',
          depositAmount: participant.depositAmount
            ? parseFloat(participant.depositAmount.toString())
            : null,
        };
      }
    }

    // Rule 5: No deposit paid - nothing to refund
    if (!participant.depositPaidAt || !participant.depositAmount) {
      return {
        eligible: false,
        reason: 'No deposit paid',
        depositAmount: null,
      };
    }

    // All checks passed - eligible for 100% refund
    return {
      eligible: true,
      reason: 'Eligible for 100% refund',
      depositAmount: parseFloat(participant.depositAmount.toString()),
    };
  }

  /**
   * User requests a refund (typically after withdrawal)
   * Sends notification email to admin
   */
  async requestRefund(
    auctionId: string,
    userId: string,
    reason?: string
  ): Promise<RefundDetailDto> {
    const participant = await this.prisma.auctionParticipant.findUnique({
      where: { auctionId_userId: { auctionId, userId } },
      include: {
        user: { select: { email: true, fullName: true } },
        auction: { select: { code: true, name: true } },
      },
    });

    if (!participant) {
      throw new NotFoundException('Registration not found');
    }

    // Check if already requested
    if (participant.refundStatus === RefundStatus.PENDING) {
      throw new ConflictException('Refund already requested');
    }

    if (participant.refundStatus === RefundStatus.PROCESSED) {
      throw new ConflictException('Refund already processed');
    }

    // Check eligibility
    const eligibility = await this.evaluateRefundEligibility(participant.id);
    if (!eligibility.eligible) {
      throw new BadRequestException(
        `Not eligible for refund: ${eligibility.reason}`
      );
    }

    // Update refund status to pending
    const updated = await this.prisma.auctionParticipant.update({
      where: { id: participant.id },
      data: {
        refundStatus: RefundStatus.PENDING,
        refundRequestedAt: new Date(),
      },
      include: {
        user: { select: { email: true, fullName: true } },
        auction: { select: { code: true, name: true } },
      },
    });

    this.logger.log(
      `Refund requested by user ${userId} for auction ${auctionId}. Reason: ${
        reason || 'Not specified'
      }`
    );

    // Send email notification to admin
    await this.notifyAdminOfRefundRequest(updated, reason);

    return this.toRefundDetailDto(updated, eligibility);
  }

  /**
   * Admin approves a pending refund
   * Sends notification email to user
   */
  async approveRefund(
    participantId: string,
    adminId: string
  ): Promise<RefundDetailDto> {
    const participant = await this.getParticipantWithDetails(participantId);

    if (participant.refundStatus !== RefundStatus.PENDING) {
      throw new BadRequestException('Can only approve pending refund requests');
    }

    const eligibility = await this.evaluateRefundEligibility(participantId);
    if (!eligibility.eligible) {
      throw new BadRequestException(
        `Not eligible for refund: ${eligibility.reason}`
      );
    }

    const updated = await this.prisma.auctionParticipant.update({
      where: { id: participantId },
      data: { refundStatus: RefundStatus.APPROVED },
      include: {
        user: { select: { email: true, fullName: true } },
        auction: { select: { code: true, name: true } },
      },
    });

    this.logger.log(
      `Refund approved for participant ${participantId} by admin ${adminId}`
    );

    // Send email notification to user
    await this.notifyUserOfRefundApproval(updated);

    return this.toRefundDetailDto(updated, eligibility);
  }

  /**
   * Admin rejects a pending refund
   * Sends notification email to user
   */
  async rejectRefund(
    participantId: string,
    adminId: string,
    reason: string
  ): Promise<RefundDetailDto> {
    const participant = await this.getParticipantWithDetails(participantId);

    if (participant.refundStatus !== RefundStatus.PENDING) {
      throw new BadRequestException('Can only reject pending refund requests');
    }

    const updated = await this.prisma.auctionParticipant.update({
      where: { id: participantId },
      data: {
        refundStatus: RefundStatus.REJECTED,
        // Store rejection reason in disqualifiedReason if needed
      },
      include: {
        user: { select: { email: true, fullName: true } },
        auction: { select: { code: true, name: true } },
      },
    });

    this.logger.log(
      `Refund rejected for participant ${participantId} by admin ${adminId}. Reason: ${reason}`
    );

    // Send email notification to user
    await this.notifyUserOfRefundRejection(updated, reason);

    const eligibility = await this.evaluateRefundEligibility(participantId);
    return this.toRefundDetailDto(updated, eligibility);
  }

  /**
   * Process an approved refund (execute the actual refund)
   */
  async processRefund(
    participantId: string,
    adminId: string
  ): Promise<RefundDetailDto> {
    const participant = await this.getParticipantWithDetails(participantId);

    if (participant.refundStatus !== RefundStatus.APPROVED) {
      throw new BadRequestException('Can only process approved refunds');
    }

    // Check disqualification status one more time
    if (participant.isDisqualified) {
      throw new ForbiddenException(
        'Cannot process refund for disqualified participant'
      );
    }

    // Process the actual refund via payment service
    const depositPaymentId = participant.depositPaymentId;
    if (depositPaymentId) {
      try {
        await this.paymentService.refundDeposit(
          participant.id,
          'Admin approved refund request',
          adminId
        );
      } catch (error) {
        this.logger.error(
          `Failed to process refund for ${participantId}`,
          error
        );
        throw new BadRequestException(
          `Refund processing failed: ${error.message}`
        );
      }
    }

    const updated = await this.prisma.auctionParticipant.update({
      where: { id: participantId },
      data: {
        refundStatus: RefundStatus.PROCESSED,
        refundProcessedAt: new Date(),
      },
      include: {
        user: { select: { email: true, fullName: true } },
        auction: { select: { code: true, name: true } },
      },
    });

    this.logger.log(
      `Refund processed for participant ${participantId} by admin ${adminId}`
    );

    const eligibility = await this.evaluateRefundEligibility(participantId);
    return this.toRefundDetailDto(updated, eligibility);
  }

  /**
   * Batch process all eligible refunds for an auction
   */
  async processAllRefundsForAuction(
    auctionId: string,
    _adminId: string
  ): Promise<{ processed: number; skipped: number; failed: number }> {
    const participants = await this.prisma.auctionParticipant.findMany({
      where: {
        auctionId,
        depositPaidAt: { not: null },
        isDisqualified: false,
        refundStatus: { not: RefundStatus.PROCESSED },
      },
      include: { bids: { where: { isWinningBid: true } } },
    });

    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const participant of participants) {
      // Skip winners
      if (participant.bids.some((bid) => bid.isWinningBid)) {
        skipped++;
        continue;
      }

      try {
        const eligibility = await this.evaluateRefundEligibility(
          participant.id
        );
        if (!eligibility.eligible) {
          skipped++;
          continue;
        }

        // Auto-approve and process
        await this.prisma.auctionParticipant.update({
          where: { id: participant.id },
          data: {
            refundStatus: RefundStatus.PROCESSED,
            refundProcessedAt: new Date(),
          },
        });

        // Process actual refund
        if (participant.depositPaymentId) {
          await this.paymentService.refundDeposit(
            participant.id,
            'Batch refund processing',
            auctionId // Using auctionId as identifier since this is batch
          );
        }

        processed++;
      } catch (error) {
        this.logger.error(
          `Failed to process refund for participant ${participant.id}`,
          error
        );
        failed++;
      }
    }

    this.logger.log(
      `Batch refund for auction ${auctionId} by admin ${_adminId}: processed=${processed}, skipped=${skipped}, failed=${failed}`
    );

    return { processed, skipped, failed };
  }

  /**
   * List all refund records with filtering
   */
  async listRefunds(query: {
    auctionId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const { auctionId, status, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: {
      depositPaidAt?: { not: null };
      auctionId?: string;
      refundStatus?: string;
    } = {
      depositPaidAt: { not: null },
    };

    if (auctionId) {
      where.auctionId = auctionId;
    }

    if (status) {
      where.refundStatus = status;
    }

    const [participants, total] = await Promise.all([
      this.prisma.auctionParticipant.findMany({
        where,
        include: {
          user: { select: { email: true, fullName: true } },
          auction: { select: { code: true, name: true } },
        },
        skip,
        take: limit,
        orderBy: { refundRequestedAt: 'desc' },
      }),
      this.prisma.auctionParticipant.count({ where }),
    ]);

    const data = await Promise.all(
      participants.map(async (p) => {
        const eligibility = await this.evaluateRefundEligibility(p.id);
        return this.toRefundDetailDto(p, eligibility);
      })
    );

    return {
      data,
      pagination: {
        currentPage: page,
        pageSize: limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get detailed refund info for a participant
   */
  async getRefundDetail(participantId: string): Promise<RefundDetailDto> {
    const participant = await this.getParticipantWithDetails(participantId);
    const eligibility = await this.evaluateRefundEligibility(participantId);
    return this.toRefundDetailDto(participant, eligibility);
  }

  /**
   * Mark a participant as disqualified
   */
  async disqualifyParticipant(
    participantId: string,
    reason: DisqualificationReason,
    adminId: string
  ): Promise<void> {
    const participant = await this.prisma.auctionParticipant.findUnique({
      where: { id: participantId },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    if (participant.isDisqualified) {
      throw new ConflictException('Participant already disqualified');
    }

    await this.prisma.auctionParticipant.update({
      where: { id: participantId },
      data: {
        isDisqualified: true,
        disqualifiedAt: new Date(),
        disqualifiedReason: reason,
        refundStatus: RefundStatus.FORFEITED,
      },
    });

    this.logger.log(
      `Participant ${participantId} disqualified by admin ${adminId}. Reason: ${reason}`
    );
  }

  // ============ Private Helpers ============

  private async getParticipantWithDetails(participantId: string) {
    const participant = await this.prisma.auctionParticipant.findUnique({
      where: { id: participantId },
      include: {
        user: { select: { email: true, fullName: true } },
        auction: { select: { code: true, name: true } },
      },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    return participant;
  }

  private toRefundDetailDto(
    participant: {
      id: string;
      userId: string;
      auctionId: string;
      depositAmount: { toString: () => string } | null;
      depositPaidAt: Date | null;
      refundStatus: string | null;
      refundRequestedAt: Date | null;
      refundProcessedAt: Date | null;
      isDisqualified: boolean;
      disqualifiedReason: string | null;
      disqualifiedAt: Date | null;
      user: { email: string; fullName: string };
      auction: { code: string; name: string };
    },
    eligibility: RefundEligibility
  ): RefundDetailDto {
    return {
      participant: {
        id: participant.id,
        userId: participant.userId,
        auctionId: participant.auctionId,
        user: participant.user,
        auction: participant.auction,
      },
      deposit: {
        amount: participant.depositAmount
          ? parseFloat(participant.depositAmount.toString())
          : null,
        paidAt: participant.depositPaidAt,
      },
      refund: {
        status: participant.refundStatus,
        requestedAt: participant.refundRequestedAt,
        processedAt: participant.refundProcessedAt,
      },
      eligibility,
      disqualification: {
        isDisqualified: participant.isDisqualified,
        reason: participant.disqualifiedReason,
        disqualifiedAt: participant.disqualifiedAt,
      },
    };
  }

  private async notifyAdminOfRefundRequest(
    participant: {
      user: { email: string; fullName: string };
      auction: { code: string; name: string };
      depositAmount: { toString: () => string } | null;
    },
    reason?: string
  ): Promise<void> {
    try {
      // Get admin emails
      const admins = await this.prisma.user.findMany({
        where: { role: { in: ['admin', 'super_admin', 'auctioneer'] } },
        select: { email: true, fullName: true },
      });

      for (const admin of admins) {
        await this.emailService.sendAdminRefundRequestedEmail({
          recipientEmail: admin.email,
          adminName: admin.fullName,
          userName: participant.user.fullName,
          userEmail: participant.user.email,
          auctionCode: participant.auction.code,
          auctionName: participant.auction.name,
          depositAmount: participant.depositAmount?.toString() || '0',
          requestedAt: new Date(),
          reason: reason,
        });
      }
    } catch (error) {
      this.logger.error('Failed to notify admins of refund request', error);
    }
  }

  private async notifyUserOfRefundApproval(participant: {
    user: { email: string; fullName: string };
    auction: { code: string; name: string };
    depositAmount: { toString: () => string } | null;
  }): Promise<void> {
    try {
      await this.emailService.sendRefundApprovedEmail({
        recipientEmail: participant.user.email,
        recipientName: participant.user.fullName,
        auctionCode: participant.auction.code,
        auctionName: participant.auction.name,
        refundAmount: participant.depositAmount?.toString() || '0',
        approvedAt: new Date(),
      });
    } catch (error) {
      this.logger.error('Failed to notify user of refund approval', error);
    }
  }

  private async notifyUserOfRefundRejection(
    participant: {
      user: { email: string; fullName: string };
      auction: { code: string; name: string };
      depositAmount: { toString: () => string } | null;
    },
    reason: string
  ): Promise<void> {
    try {
      await this.emailService.sendRefundRejectedEmail({
        recipientEmail: participant.user.email,
        recipientName: participant.user.fullName,
        auctionCode: participant.auction.code,
        auctionName: participant.auction.name,
        depositAmount: participant.depositAmount?.toString() || '0',
        rejectedAt: new Date(),
        rejectionReason: reason,
      });
    } catch (error) {
      this.logger.error('Failed to notify user of refund rejection', error);
    }
  }
}
