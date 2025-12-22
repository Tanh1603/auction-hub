import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailQueueService } from '../../../common/email/email-queue.service';
import { BiddingGateway } from '../../bidding/bidding.gateway';
import { PolicyCalculationService } from '../../auction-policy/policy-calculation.service';
import { AuctionEvaluationService } from './auction-evaluation.service';
import { WinnerPaymentService } from './winner-payment.service';
import { PaymentService } from '../../../payment/payment.service';
import { FinalizeAuctionDto } from '../dto/finalize-auction.dto';
import { OverrideAuctionStatusDto } from '../dto/override-auction-status.dto';
import { AuctionStatus, ContractStatus } from '../../../../generated';
import { getPropertyOwnerId } from '../../../common/types/property-owner-snapshot.interface';
import {
  ManagementDetailDto,
  BidSummaryDto,
  ParticipantSummaryDto,
} from '../dto/management-detail.dto';

/**
 * Service responsible for auction owner/auctioneer operations
 * Context: Auction Owner/Auctioneer
 */
@Injectable()
export class AuctionOwnerService {
  private readonly logger = new Logger(AuctionOwnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailQueueService: EmailQueueService,
    private readonly biddingGateway: BiddingGateway,
    private readonly policyCalc: PolicyCalculationService,
    private readonly evaluationService: AuctionEvaluationService,
    private readonly paymentService: PaymentService,
    private readonly winnerPaymentService: WinnerPaymentService
  ) {}

  /**
   * Verify winner payment before contract creation
   * Throws error if payment is not found or not verified
   */
  private async verifyWinnerPaymentBeforeContract(
    auctionId: string,
    winnerUserId: string
  ): Promise<void> {
    // Find winning payment record
    const winningPayment = await this.prisma.payment.findFirst({
      where: {
        userId: winnerUserId,
        auctionId: auctionId,
        paymentType: 'winning_payment',
      },
      orderBy: { createdAt: 'desc' }, // Get most recent
    });

    if (!winningPayment) {
      throw new BadRequestException(
        'Winner has not initiated payment yet. Please complete payment before finalizing the auction.'
      );
    }

    // Get Stripe session ID from payment
    const stripeSessionId = winningPayment.transactionId;
    if (!stripeSessionId) {
      this.logger.error(
        `Payment record ${winningPayment.id} exists but has no transaction ID`
      );
      throw new BadRequestException(
        'Payment record is missing transaction information. Please initiate a new payment.'
      );
    }

    // Verify payment with Stripe
    let verification;
    try {
      verification = await this.paymentService.verifyPayment(stripeSessionId);
    } catch (error) {
      this.logger.error(
        `Failed to verify payment ${stripeSessionId} for auction ${auctionId}:`,
        error
      );
      throw new BadRequestException(
        `Payment verification failed: ${error.message}`
      );
    }

    // Check if payment is completed
    if (verification.status !== 'paid') {
      throw new BadRequestException(
        `Payment not completed. Status: ${verification.status}. Please complete payment before finalizing the auction.`
      );
    }

    this.logger.log(
      `Winner payment verified for auction ${auctionId}. Payment status: ${verification.status}`
    );
  }

  /**
   * Finalize auction with automatic evaluation
   */
  async finalizeAuction(dto: FinalizeAuctionDto, userId: string) {
    // Load auction with participants and bids
    // Note: owner relation removed - propertyOwner is now a JSON field
    const auction = await this.prisma.auction.findUnique({
      where: { id: dto.auctionId },
      include: {
        participants: {
          include: {
            user: true,
          },
        },
        bids: {
          where: { isDenied: false, isWithdrawn: false },
          orderBy: { amount: 'desc' },
          include: {
            participant: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (!auction) {
      throw new NotFoundException('Auction not found');
    }

    // Fetch the user to check their role
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    // Verify that the user is the auction owner OR an admin/super admin
    // Note: propertyOwner is now a JSON field, extract ID using helper
    const propertyOwnerId = getPropertyOwnerId(auction.propertyOwner);
    const isOwner = propertyOwnerId === userId;
    const isAdminOrSuperAdmin =
      user.role === 'admin' || user.role === 'super_admin';

    if (!isOwner && !isAdminOrSuperAdmin) {
      throw new ForbiddenException(
        'Only the auction owner, admin, or super admin can finalize the auction'
      );
    }

    // Check if auction has already been finalized
    // Note: no_bid and cancelled have been replaced with 'failed' in the new schema
    if (
      auction.status === AuctionStatus.success ||
      auction.status === AuctionStatus.failed
    ) {
      throw new BadRequestException('Auction has already been finalized');
    }

    // Check if auction has ended
    const now = new Date();
    if (now < auction.auctionEndAt) {
      throw new BadRequestException('Cannot finalize auction before it ends');
    }

    // Perform automatic evaluation if not skipped
    let evaluation = null;
    if (!dto.skipAutoEvaluation) {
      evaluation = await this.evaluationService.evaluateAuction(dto.auctionId);

      if (!evaluation.canFinalize && evaluation.issues.length > 0) {
        this.logger.warn(
          `Auction ${
            dto.auctionId
          } has evaluation issues: ${evaluation.issues.join(', ')}`
        );
        // Continue anyway - allow auctioneer to make final decision
      }
    }

    // Determine the winning bid
    let winningBid = null;
    let newStatus: AuctionStatus;

    if (dto.winningBidId) {
      // Auctioneer explicitly selected a winning bid
      winningBid = auction.bids.find((bid) => bid.id === dto.winningBidId);
      if (!winningBid) {
        throw new NotFoundException(
          'Winning bid not found or has been denied/withdrawn'
        );
      }
      newStatus = AuctionStatus.success;
    } else if (evaluation?.recommendedStatus) {
      // Use evaluation recommendation
      newStatus = evaluation.recommendedStatus;
      if (newStatus === AuctionStatus.success && auction.bids.length > 0) {
        winningBid = auction.bids[0]; // Highest bid
      }
    } else if (auction.bids.length > 0) {
      // Fallback: auto-select highest bid
      winningBid = auction.bids[0];
      newStatus = AuctionStatus.success;
    } else {
      // No bids - auction failed
      // Note: no_bid has been replaced with 'failed' in the new schema
      newStatus = AuctionStatus.failed;
    }

    // Use transaction to finalize auction
    const result = await this.prisma.$transaction(async (tx) => {
      // Update auction status
      const updatedAuction = await tx.auction.update({
        where: { id: auction.id },
        data: {
          status: newStatus,
          updatedAt: new Date(),
        },
      });

      let contract = null;

      if (winningBid) {
        // Mark the winning bid
        await tx.auctionBid.update({
          where: { id: winningBid.id },
          data: { isWinningBid: true },
        });

        // Create contract for the winning bid
        // Note: propertyOwner is now a JSON field, extract ID using helper
        contract = await tx.contract.create({
          data: {
            auctionId: auction.id,
            winningBidId: winningBid.id,
            propertyOwnerUserId: propertyOwnerId,
            buyerUserId: winningBid.participant.userId,
            createdBy: userId,
            price: winningBid.amount,
            status: ContractStatus.draft,
          },
        });

        this.logger.log(
          `Contract ${contract.id} created for auction ${auction.id}`
        );

        // Calculate comprehensive financial summary after successful auction
        try {
          const financialSummary =
            await this.policyCalc.calculateAuctionFinancialSummary(
              auction.id,
              parseFloat(winningBid.amount.toString())
            );
          this.logger.log(
            `Financial summary calculated for auction ${auction.id}. Net to seller: ${financialSummary.netAmountToSeller}`
          );
        } catch (error) {
          this.logger.error(
            `Failed to calculate financial summary for auction ${auction.id}`,
            error
          );
          // Don't fail the entire transaction if financial summary fails
          // Admin can recalculate it later
        }
      }

      // Create audit log entry for finalization
      await tx.auctionAuditLog.create({
        data: {
          auctionId: auction.id,
          performedBy: userId,
          action: 'AUCTION_FINALIZED',
          previousStatus: auction.status,
          newStatus: newStatus,
          reason: 'Auction finalized by auctioneer',
          notes: dto.notes,
          metadata: {
            winningBidId: winningBid?.id,
            contractId: contract?.id,
            totalBids: auction.bids.length,
            totalParticipants: auction.participants.length,
            evaluation: evaluation
              ? {
                  recommendedStatus: evaluation.recommendedStatus,
                  meetsReservePrice: evaluation.meetsReservePrice,
                  hasMinimumParticipants: evaluation.hasMinimumParticipants,
                  hasValidBids: evaluation.hasValidBids,
                  bidIncrementCompliance: evaluation.bidIncrementCompliance,
                }
              : null,
            timestamp: new Date().toISOString(),
          },
        },
      });

      // Log the finalization
      this.logger.log(
        `Auction ${auction.id} finalized with status ${newStatus}`
      );

      return {
        auction: updatedAuction,
        winningBid,
        contract,
      };
    });

    const emailQueuePromises = [];
    auction.participants.forEach((participant) => {
      const isWinner = winningBid?.participant.userId === participant.userId;

      // 1. All participants get the result email (Winner/Non-winner)
      emailQueuePromises.push(
        this.emailQueueService.queueAuctionResultEmail({
          recipientEmail: participant.user.email,
          recipientName: participant.user.fullName,
          auctionCode: auction.code,
          auctionName: auction.name,
          isWinner,
          winningAmount: winningBid?.amount.toString(),
          winnerName: winningBid?.participant.user.fullName,
          totalBids: auction.bids.length,
        })
      );

      // 2. Winner also gets the detailed payment request email
      if (isWinner) {
        emailQueuePromises.push(
          this.winnerPaymentService.sendWinnerPaymentRequestEmail(auction.id)
        );
      }
    });

    // Queue emails to background
    await Promise.all(emailQueuePromises);
    this.logger.log(
      `Queued ${auction.participants.length} auction result emails`
    );

    // Emit WebSocket event for auction finalization
    this.biddingGateway.emitAuctionUpdate(auction.id, {
      auctionId: auction.id,
      status: newStatus,
      finalizedAt: new Date(),
      winningBid: winningBid
        ? {
            bidId: winningBid.id,
            amount: winningBid.amount.toString(),
            winnerId: winningBid.participant.userId,
            winnerName: winningBid.participant.user.fullName,
          }
        : null,
      contractId: result.contract?.id,
    });

    return {
      auctionId: auction.id,
      status: newStatus,
      finalizedAt: new Date(),
      winningBidId: winningBid?.id,
      contractId: result.contract?.id,
      totalBids: auction.bids.length,
      totalParticipants: auction.participants.length,
      evaluation,
    };
  }

  /**
   * Admin override - manually change auction status with audit trail
   */
  async overrideAuctionStatus(dto: OverrideAuctionStatusDto, adminId: string) {
    const auction = await this.prisma.auction.findUnique({
      where: { id: dto.auctionId },
      include: {
        bids: {
          where: { isDenied: false, isWithdrawn: false },
          orderBy: { amount: 'desc' },
          include: {
            participant: {
              include: {
                user: true,
              },
            },
          },
        },
        participants: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!auction) {
      throw new NotFoundException('Auction not found');
    }

    // Fetch the user to check their role
    const user = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    // Verify that the user is the auction owner OR an admin/super admin
    // Note: propertyOwner is now a JSON field, extract ID using helper
    const propertyOwnerId = getPropertyOwnerId(auction.propertyOwner);
    const isOwner = propertyOwnerId === adminId;
    const isAdminOrSuperAdmin =
      user.role === 'admin' || user.role === 'super_admin';

    if (!isOwner && !isAdminOrSuperAdmin) {
      throw new ForbiddenException(
        'Only the auction owner, admin, or super admin can override auction status'
      );
    }

    this.logger.warn(
      `Admin ${adminId} is overriding auction ${dto.auctionId} status to ${dto.newStatus}. Reason: ${dto.reason}`
    );

    let winningBid = null;
    let contract = null;

    // Determine winning bid before transaction
    if (dto.newStatus === AuctionStatus.success) {
      if (dto.winningBidId) {
        winningBid = auction.bids.find((b) => b.id === dto.winningBidId);
        if (!winningBid) {
          throw new NotFoundException('Specified winning bid not found');
        }
      } else if (auction.bids.length > 0) {
        winningBid = auction.bids[0];
      }
      // NOTE: Payment verification is NOT required before override.
      // Admin can override to 'success' to create contract in 'draft' status.
      // Winner then receives notification to pay, and payment verification
      // happens afterward via the normal winner payment flow.
    }

    // Use transaction for status override
    await this.prisma.$transaction(async (tx) => {
      // Update auction status
      const updatedAuction = await tx.auction.update({
        where: { id: auction.id },
        data: {
          status: dto.newStatus,
          updatedAt: new Date(),
        },
      });

      // Handle winning bid if status is success
      if (dto.newStatus === AuctionStatus.success) {
        if (winningBid) {
          // Mark as winning bid
          await tx.auctionBid.update({
            where: { id: winningBid.id },
            data: { isWinningBid: true },
          });

          // Check if contract already exists
          const existingContract = await tx.contract.findFirst({
            where: { auctionId: auction.id },
          });

          if (!existingContract) {
            // Create new contract
            // Note: propertyOwner is now a JSON field, extract ID using helper
            contract = await tx.contract.create({
              data: {
                auctionId: auction.id,
                winningBidId: winningBid.id,
                propertyOwnerUserId: propertyOwnerId,
                buyerUserId: winningBid.participant.userId,
                createdBy: adminId,
                price: winningBid.amount,
                status: ContractStatus.draft,
              },
            });

            // Calculate comprehensive financial summary after successful auction
            try {
              const financialSummary =
                await this.policyCalc.calculateAuctionFinancialSummary(
                  auction.id,
                  parseFloat(winningBid.amount.toString())
                );
              this.logger.log(
                `Financial summary calculated for overridden auction ${auction.id}. Net to seller: ${financialSummary.netAmountToSeller}`
              );
            } catch (error) {
              this.logger.error(
                `Failed to calculate financial summary for overridden auction ${auction.id}`,
                error
              );
              // Don't fail the entire transaction if financial summary fails
            }
          } else {
            contract = existingContract;
          }
        }
      } else if (dto.newStatus === AuctionStatus.failed) {
        // If failing/cancelling, mark any existing contracts as cancelled
        // Note: cancelled status has been replaced with 'failed' in AuctionStatus enum
        await tx.contract.updateMany({
          where: { auctionId: auction.id },
          data: {
            status: ContractStatus.cancelled,
            cancelledAt: new Date(),
          },
        });
      }

      // Create audit log entry
      await tx.auctionAuditLog.create({
        data: {
          auctionId: auction.id,
          performedBy: adminId,
          action: 'STATUS_OVERRIDE',
          previousStatus: auction.status,
          newStatus: dto.newStatus,
          reason: dto.reason,
          notes: dto.notes,
          metadata: {
            winningBidId: dto.winningBidId,
            timestamp: new Date().toISOString(),
          },
        },
      });

      return { auction: updatedAuction, winningBid, contract };
    });

    // Send notification emails if finalizing
    // Note: no_bid has been replaced with 'failed' in the new schema
    if (
      dto.newStatus === AuctionStatus.success ||
      dto.newStatus === AuctionStatus.failed
    ) {
      const emailQueuePromises = [];
      auction.participants.forEach((participant) => {
        const isWinner = winningBid?.participant.userId === participant.userId;

        // 1. All participants get the result email
        emailQueuePromises.push(
          this.emailQueueService.queueAuctionResultEmail({
            recipientEmail: participant.user.email,
            recipientName: participant.user.fullName,
            auctionCode: auction.code,
            auctionName: auction.name,
            isWinner,
            winningAmount: winningBid?.amount.toString(),
            winnerName: winningBid?.participant.user.fullName,
            totalBids: auction.bids.length,
          })
        );

        // 2. Winner also gets the detailed payment request email
        if (isWinner) {
          emailQueuePromises.push(
            this.winnerPaymentService.sendWinnerPaymentRequestEmail(auction.id)
          );
        }
      });

      Promise.all(emailQueuePromises).catch((err) => {
        this.logger.error('Error queuing auction result emails:', err);
      });
    }

    // Emit WebSocket event
    this.biddingGateway.emitAuctionUpdate(auction.id, {
      auctionId: auction.id,
      status: dto.newStatus,
      overridden: true,
      overrideReason: dto.reason,
      finalizedAt: new Date(),
      winningBid: winningBid
        ? {
            bidId: winningBid.id,
            amount: winningBid.amount.toString(),
            winnerId: winningBid.participant.userId,
            winnerName: winningBid.participant.user.fullName,
          }
        : null,
      contractId: contract?.id,
    });

    this.logger.log(
      `Auction ${auction.id} status overridden to ${dto.newStatus} by admin ${adminId}`
    );

    return {
      auctionId: auction.id,
      previousStatus: auction.status,
      newStatus: dto.newStatus,
      reason: dto.reason,
      overriddenBy: adminId,
      overriddenAt: new Date(),
      winningBidId: winningBid?.id,
      contractId: contract?.id,
    };
  }

  /**
   * Get audit logs for an auction
   */
  async getAuctionAuditLogs(auctionId: string, userId: string) {
    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
    });

    if (!auction) {
      throw new NotFoundException('Auction not found');
    }

    // Fetch the user to check their role
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    // Only auction owner, admin, or super admin can view audit logs
    // Note: propertyOwner is now a JSON field, extract ID using helper
    const isOwner = getPropertyOwnerId(auction.propertyOwner) === userId;
    const isAdminOrSuperAdmin =
      user.role === 'admin' || user.role === 'super_admin';

    if (!isOwner && !isAdminOrSuperAdmin) {
      throw new ForbiddenException(
        'Only the auction owner, admin, or super admin can view audit logs'
      );
    }

    const auditLogs = await this.prisma.auctionAuditLog.findMany({
      where: { auctionId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return auditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      previousStatus: log.previousStatus,
      newStatus: log.newStatus,
      reason: log.reason,
      notes: log.notes,
      metadata: log.metadata,
      performedBy: {
        userId: log.user.id,
        fullName: log.user.fullName,
        email: log.user.email,
      },
      createdAt: log.createdAt,
    }));
  }

  /**
   * Get management detail for admin override operations
   * Returns full bidding pool and participant status for manual winner selection
   * Only accessible by admin/super_admin
   */
  async getManagementDetail(
    auctionId: string,
    adminId: string
  ): Promise<ManagementDetailDto> {
    // Verify admin role
    const user = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    if (user.role !== 'admin' && user.role !== 'super_admin') {
      throw new ForbiddenException(
        'Only admin or super_admin can access management details'
      );
    }

    // Fetch auction with all related data
    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        bids: {
          orderBy: { amount: 'desc' },
          include: {
            participant: {
              include: {
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
            bids: {
              where: { isDenied: false, isWithdrawn: false },
              orderBy: { amount: 'desc' },
              take: 1,
            },
          },
        },
        contracts: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!auction) {
      throw new NotFoundException('Auction not found');
    }

    // Get evaluation data
    let evaluationData = null;
    try {
      const evaluation = await this.evaluationService.evaluateAuction(
        auctionId
      );
      evaluationData = {
        meetsReservePrice: evaluation.meetsReservePrice,
        hasMinimumParticipants: evaluation.hasMinimumParticipants,
        hasValidBids: evaluation.hasValidBids,
        recommendedStatus: evaluation.recommendedStatus,
        issues: evaluation.issues || [],
      };
    } catch (error) {
      this.logger.warn(`Could not get evaluation for ${auctionId}: ${error}`);
    }

    // Build bid summaries
    const bids: BidSummaryDto[] = auction.bids.map((bid) => ({
      bidId: bid.id,
      participantId: bid.participantId,
      amount: bid.amount.toString(),
      bidAt: bid.bidAt,
      bidType: bid.bidType,
      isWinningBid: bid.isWinningBid,
      isDenied: bid.isDenied,
      isWithdrawn: bid.isWithdrawn,
      deniedReason: bid.deniedReason || undefined,
      participant: {
        userId: bid.participant.user.id,
        fullName: bid.participant.user.fullName,
        email: bid.participant.user.email,
        depositPaid: !!bid.participant.depositPaidAt,
        checkedIn: !!bid.participant.checkedInAt,
        isDisqualified: bid.participant.isDisqualified,
      },
    }));

    // Build participant summaries
    const participants: ParticipantSummaryDto[] = auction.participants.map(
      (p) => ({
        participantId: p.id,
        userId: p.user.id,
        fullName: p.user.fullName,
        email: p.user.email,
        registeredAt: p.registeredAt,
        confirmedAt: p.confirmedAt,
        checkedInAt: p.checkedInAt,
        depositPaidAt: p.depositPaidAt,
        depositAmount: p.depositAmount?.toString() || null,
        isDisqualified: p.isDisqualified,
        disqualifiedReason: p.disqualifiedReason,
        withdrawnAt: p.withdrawnAt,
        totalBids: auction.bids.filter((b) => b.participantId === p.id).length,
        highestBidAmount: p.bids[0]?.amount.toString() || null,
      })
    );

    // Find current winning bid
    const currentWinningBid = bids.find((b) => b.isWinningBid) || null;

    // Get highest valid bid
    const validBids = auction.bids.filter((b) => !b.isDenied && !b.isWithdrawn);
    const currentHighestBid =
      validBids.length > 0 ? validBids[0].amount.toString() : null;

    // Build contract info if exists
    const contract = auction.contracts[0]
      ? {
          contractId: auction.contracts[0].id,
          status: auction.contracts[0].status,
          createdAt: auction.contracts[0].createdAt,
        }
      : null;

    // Calculate summary counts
    const summary = {
      totalBids: auction.bids.length,
      validBids: validBids.length,
      deniedBids: auction.bids.filter((b) => b.isDenied).length,
      totalParticipants: auction.participants.length,
      checkedInParticipants: auction.participants.filter((p) => p.checkedInAt)
        .length,
      depositPaidParticipants: auction.participants.filter(
        (p) => p.depositPaidAt
      ).length,
      disqualifiedParticipants: auction.participants.filter(
        (p) => p.isDisqualified
      ).length,
    };

    return {
      auctionId: auction.id,
      auctionCode: auction.code,
      auctionName: auction.name,
      status: auction.status,
      auctionStartAt: auction.auctionStartAt,
      auctionEndAt: auction.auctionEndAt,
      depositEndAt: auction.depositEndAt,
      startingPrice: auction.startingPrice.toString(),
      reservePrice: auction.reservePrice?.toString() || null,
      bidIncrement: auction.bidIncrement.toString(),
      currentHighestBid,
      bids,
      participants,
      currentWinningBid,
      evaluation: evaluationData,
      contract,
      summary,
    };
  }
}
