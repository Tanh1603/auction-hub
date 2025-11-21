import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../../common/services/email.service';
import { BiddingGateway } from '../../bidding/bidding.gateway';
import { PolicyCalculationService } from '../../auction-policy/policy-calculation.service';
import { AuctionEvaluationService } from './auction-evaluation.service';
import { FinalizeAuctionDto } from '../dto/finalize-auction.dto';
import { OverrideAuctionStatusDto } from '../dto/override-auction-status.dto';
import { AuctionStatus, ContractStatus } from '../../../../generated';

/**
 * Service responsible for auction owner/auctioneer operations
 * Context: Auction Owner/Auctioneer
 */
@Injectable()
export class AuctionOwnerService {
  private readonly logger = new Logger(AuctionOwnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly biddingGateway: BiddingGateway,
    private readonly policyCalc: PolicyCalculationService,
    private readonly evaluationService: AuctionEvaluationService
  ) {}

  /**
   * Finalize auction with automatic evaluation
   */
  async finalizeAuction(dto: FinalizeAuctionDto, userId: string) {
    // Load auction with owner, participants, and bids
    const auction = await this.prisma.auction.findUnique({
      where: { id: dto.auctionId },
      include: {
        owner: true,
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

    // Verify that the user is the auction owner
    if (auction.propertyOwner !== userId) {
      throw new ForbiddenException(
        'Only the auction owner can finalize the auction'
      );
    }

    // Check if auction has already been finalized
    if (
      auction.status === AuctionStatus.success ||
      auction.status === AuctionStatus.no_bid ||
      auction.status === AuctionStatus.cancelled
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
      newStatus = AuctionStatus.no_bid;
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
        contract = await tx.contract.create({
          data: {
            auctionId: auction.id,
            winningBidId: winningBid.id,
            propertyOwnerUserId: auction.propertyOwner,
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

    // Send emails to all participants
    const emailPromises = auction.participants.map((participant) => {
      const isWinner = winningBid?.participant.userId === participant.userId;
      return this.emailService.sendAuctionResultEmail({
        recipientEmail: participant.user.email,
        recipientName: participant.user.fullName,
        auctionCode: auction.code,
        auctionName: auction.name,
        isWinner,
        winningAmount: winningBid?.amount.toString(),
        winnerName: winningBid?.participant.user.fullName,
        totalBids: auction.bids.length,
      });
    });

    // Send emails asynchronously
    Promise.allSettled(emailPromises).catch((err) => {
      this.logger.error('Error sending auction result emails:', err);
    });

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

    // Verify admin is the owner
    if (auction.propertyOwner !== adminId) {
      throw new ForbiddenException(
        'Only the auction owner can override auction status'
      );
    }

    this.logger.warn(
      `Admin ${adminId} is overriding auction ${dto.auctionId} status to ${dto.newStatus}. Reason: ${dto.reason}`
    );

    let winningBid = null;
    let contract = null;

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
        if (dto.winningBidId) {
          winningBid = auction.bids.find((b) => b.id === dto.winningBidId);
          if (!winningBid) {
            throw new NotFoundException('Specified winning bid not found');
          }
        } else if (auction.bids.length > 0) {
          winningBid = auction.bids[0];
        }

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
            contract = await tx.contract.create({
              data: {
              auctionId: auction.id,
              winningBidId: winningBid.id,
              propertyOwnerUserId: auction.propertyOwner,
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
      } else if (dto.newStatus === AuctionStatus.cancelled) {
        // If cancelling, mark any existing contracts as cancelled
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
    if (
      dto.newStatus === AuctionStatus.success ||
      dto.newStatus === AuctionStatus.no_bid
    ) {
      const emailPromises = auction.participants.map((participant) => {
        const isWinner = winningBid?.participant.userId === participant.userId;
        return this.emailService.sendAuctionResultEmail({
          recipientEmail: participant.user.email,
          recipientName: participant.user.fullName,
          auctionCode: auction.code,
          auctionName: auction.name,
          isWinner,
          winningAmount: winningBid?.amount.toString(),
          winnerName: winningBid?.participant.user.fullName,
          totalBids: auction.bids.length,
        });
      });

      Promise.allSettled(emailPromises).catch((err) => {
        this.logger.error('Error sending auction result emails:', err);
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

    // Only auction owner can view audit logs
    if (auction.propertyOwner !== userId) {
      throw new ForbiddenException(
        'Only the auction owner can view audit logs'
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
}
