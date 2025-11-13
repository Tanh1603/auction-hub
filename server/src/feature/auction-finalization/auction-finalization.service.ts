import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/services/email.service';
import { BiddingGateway } from '../bidding/bidding.gateway';
import { FinalizeAuctionDto } from './dto/finalize-auction.dto';
import { OverrideAuctionStatusDto } from './dto/override-auction-status.dto';
import { AuctionResultDto } from './dto/auction-result.dto';
import { EvaluationResultDto } from './dto/evaluation-result.dto';
import { Prisma } from '../../../generated';
import { AuctionStatus, ContractStatus } from '../../../generated';

@Injectable()
export class AuctionFinalizationService {
  private readonly logger = new Logger(AuctionFinalizationService.name);

  // Configuration - can be moved to environment variables or database
  private readonly MINIMUM_PARTICIPANTS = 2;
  private readonly MINIMUM_BID_INCREMENT_COMPLIANCE = 0.95; // 95% of bids must follow increment rules

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly biddingGateway: BiddingGateway
  ) {}

  /**
   * Automatically evaluate auction status based on business rules
   */
  async evaluateAuction(auctionId: string): Promise<EvaluationResultDto> {
    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        bids: {
          where: { isDenied: false, isWithdrawn: false },
          orderBy: { amount: 'desc' },
        },
        participants: {
          where: {
            confirmedAt: { not: null },
            rejectedAt: null,
            withdrawnAt: null,
          },
        },
      },
    });

    if (!auction) {
      throw new NotFoundException('Auction not found');
    }

    const validBids = auction.bids;
    const confirmedParticipants = auction.participants;
    const highestBid = validBids[0];

    const issues: string[] = [];
    let recommendedStatus: AuctionStatus;

    // Check if auction is already finalized
    const finalStatuses: AuctionStatus[] = [
      AuctionStatus.success,
      AuctionStatus.no_bid,
      AuctionStatus.cancelled,
    ];
    const isAlreadyFinalized = finalStatuses.includes(auction.status);

    if (isAlreadyFinalized) {
      issues.push(
        `Auction has already been finalized with status: ${auction.status}`
      );
    }

    // Rule 1: Check if auction has ended
    const now = new Date();
    if (now < auction.auctionEndAt) {
      issues.push('Auction has not ended yet');
    }

    // Rule 2: Check minimum participants
    const hasMinimumParticipants =
      confirmedParticipants.length >= this.MINIMUM_PARTICIPANTS;
    if (!hasMinimumParticipants) {
      issues.push(
        `Minimum ${this.MINIMUM_PARTICIPANTS} participants required, only ${confirmedParticipants.length} confirmed`
      );
    }

    // Rule 3: Check if there are valid bids
    const hasValidBids = validBids.length > 0;
    if (!hasValidBids) {
      issues.push('No valid bids placed');
    }

    // Rule 4: Check if highest bid meets reserve price
    const reservePrice = auction.reservePrice || auction.startingPrice;
    const meetsReservePrice = highestBid
      ? highestBid.amount.gte(reservePrice)
      : false;

    if (highestBid && !meetsReservePrice) {
      issues.push(
        `Highest bid ${highestBid.amount.toString()} does not meet reserve price ${reservePrice.toString()}`
      );
    }

    // Rule 5: Check bid increment compliance
    let bidIncrementCompliance = 1.0;
    if (validBids.length > 1) {
      let compliantBids = 0;
      for (let i = 0; i < validBids.length - 1; i++) {
        const currentBid = validBids[i];
        const previousBid = validBids[i + 1];
        const difference = currentBid.amount.minus(previousBid.amount);

        // Check if difference is a multiple of bidIncrement
        if (difference.mod(auction.bidIncrement).equals(0)) {
          compliantBids++;
        }
      }
      bidIncrementCompliance = compliantBids / (validBids.length - 1);

      if (bidIncrementCompliance < this.MINIMUM_BID_INCREMENT_COMPLIANCE) {
        issues.push(
          `Bid increment compliance is ${(bidIncrementCompliance * 100).toFixed(
            1
          )}%, below required ${(
            this.MINIMUM_BID_INCREMENT_COMPLIANCE * 100
          ).toFixed(1)}%`
        );
      }
    }

    // Rule 6: Check auction duration wasn't exceeded
    const actualDuration =
      auction.auctionEndAt.getTime() - auction.auctionStartAt.getTime();
    const maxDuration = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    if (actualDuration > maxDuration) {
      issues.push(
        `Auction duration exceeded maximum allowed (${Math.floor(
          actualDuration / (24 * 60 * 60 * 1000)
        )} days)`
      );
    }

    // Determine recommended status
    if (!hasValidBids || !hasMinimumParticipants) {
      recommendedStatus = AuctionStatus.no_bid;
    } else if (meetsReservePrice) {
      recommendedStatus = AuctionStatus.success;
    } else {
      // Has bids but doesn't meet reserve
      recommendedStatus = AuctionStatus.no_bid;
      issues.push('Auction failed: reserve price not met');
    }

    // Can only finalize if:
    // 1. Auction has ended
    // 2. No issues found
    // 3. Auction is NOT already finalized
    const canFinalize =
      now >= auction.auctionEndAt && issues.length === 0 && !isAlreadyFinalized;

    return {
      auctionId: auction.id,
      currentStatus: auction.status,
      recommendedStatus,
      isAlreadyFinalized,
      meetsReservePrice,
      hasMinimumParticipants,
      hasValidBids,
      totalValidBids: validBids.length,
      totalParticipants: confirmedParticipants.length,
      highestBidAmount: highestBid?.amount.toString(),
      reservePrice: reservePrice.toString(),
      minimumParticipants: this.MINIMUM_PARTICIPANTS,
      bidIncrementCompliance: bidIncrementCompliance * 100, // Convert to percentage
      issues,
      canFinalize,
      evaluatedAt: new Date(),
    };
  }

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
    let evaluation: EvaluationResultDto | null = null;
    if (!dto.skipAutoEvaluation) {
      evaluation = await this.evaluateAuction(dto.auctionId);

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
            sellerUserId: auction.propertyOwner,
            buyerUserId: winningBid.participant.userId,
            createdBy: userId,
            price: winningBid.amount,
            status: ContractStatus.draft,
          },
        });

        this.logger.log(
          `Contract ${contract.id} created for auction ${auction.id}`
        );
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
    const result = await this.prisma.$transaction(async (tx) => {
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
                sellerUserId: auction.propertyOwner,
                buyerUserId: winningBid.participant.userId,
                createdBy: adminId,
                price: winningBid.amount,
                status: ContractStatus.draft,
              },
            });
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
   * Get auction results - available to participants and owner
   */
  async getAuctionResults(
    auctionId: string,
    userId: string
  ): Promise<AuctionResultDto> {
    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        participants: {
          where: { userId },
        },
        bids: {
          where: {
            isWinningBid: true,
            isDenied: false,
            isWithdrawn: false,
          },
          include: {
            participant: {
              include: {
                user: true,
              },
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

    // Check if user is a participant or the owner
    const isParticipant = auction.participants.length > 0;
    const isOwner = auction.propertyOwner === userId;

    if (!isParticipant && !isOwner) {
      throw new ForbiddenException(
        'You must be a participant or owner to view auction results'
      );
    }

    // Check if auction has been finalized
    if (
      auction.status !== AuctionStatus.success &&
      auction.status !== AuctionStatus.no_bid &&
      auction.status !== AuctionStatus.cancelled
    ) {
      throw new BadRequestException('Auction results are not yet available');
    }

    // Get total bids and participants count
    const totalBids = await this.prisma.auctionBid.count({
      where: {
        auctionId: auction.id,
        isDenied: false,
        isWithdrawn: false,
      },
    });

    const totalParticipants = await this.prisma.auctionParticipant.count({
      where: { auctionId: auction.id },
    });

    // Build result DTO
    const winningBid = auction.bids[0];
    const contract = auction.contracts[0];

    // Get evaluation if available
    let evaluationData = null;
    try {
      const evaluation = await this.evaluateAuction(auctionId);
      evaluationData = {
        meetsReservePrice: evaluation.meetsReservePrice,
        hasMinimumParticipants: evaluation.hasMinimumParticipants,
        hasValidBids: evaluation.hasValidBids,
        bidIncrementCompliance: evaluation.bidIncrementCompliance,
        autoEvaluated: true,
        evaluatedAt: evaluation.evaluatedAt,
      };
    } catch (error) {
      this.logger.error(`Failed to evaluate auction ${auctionId}:`, error);
    }

    const result: AuctionResultDto = {
      auctionId: auction.id,
      auctionCode: auction.code,
      auctionName: auction.name,
      status: auction.status,
      startingPrice: auction.startingPrice.toString(),
      auctionStartAt: auction.auctionStartAt,
      auctionEndAt: auction.auctionEndAt,
      finalizedAt: auction.updatedAt,
      totalBids,
      totalParticipants,
      evaluation: evaluationData,
    };

    if (winningBid) {
      result.winningBid = {
        bidId: winningBid.id,
        amount: winningBid.amount.toString(),
        bidAt: winningBid.bidAt,
        bidType: winningBid.bidType,
        winner: {
          userId: winningBid.participant.user.id,
          fullName: winningBid.participant.user.fullName,
          email: winningBid.participant.user.email,
        },
      };
    }

    if (contract) {
      result.contract = {
        contractId: contract.id,
        status: contract.status,
        createdAt: contract.createdAt,
      };
    }

    return result;
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
