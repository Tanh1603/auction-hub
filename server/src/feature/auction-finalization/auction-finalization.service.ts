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
import { PolicyCalculationService } from '../auction-policy/policy-calculation.service';
import { PaymentService } from '../../payment/payment.service';
import {
  PaymentType,
  PaymentMethod,
} from '../../payment/dto/PaymentCreateRequest.dto';

@Injectable()
export class AuctionFinalizationService {
  private readonly logger = new Logger(AuctionFinalizationService.name);

  // Configuration - can be moved to environment variables or database
  private readonly MINIMUM_PARTICIPANTS = 2;
  private readonly MINIMUM_BID_INCREMENT_COMPLIANCE = 0.95; // 95% of bids must follow increment rules

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly biddingGateway: BiddingGateway,
    private readonly policyCalc: PolicyCalculationService,
    private readonly paymentService: PaymentService
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
        financialSummary: true,
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

    // Include financial summary if available
    if (auction.financialSummary) {
      result.financialSummary = {
        finalSalePrice: parseFloat(
          auction.financialSummary.finalSalePrice.toString()
        ),
        startingPrice: parseFloat(
          auction.financialSummary.startingPrice.toString()
        ),
        commissionFee: parseFloat(
          auction.financialSummary.commissionFee.toString()
        ),
        dossierFee: parseFloat(auction.financialSummary.dossierFee.toString()),
        depositAmount: parseFloat(
          auction.financialSummary.depositAmount.toString()
        ),
        totalAuctionCosts: parseFloat(
          auction.financialSummary.totalAuctionCosts.toString()
        ),
        totalFeesToSeller: parseFloat(
          auction.financialSummary.totalFeesToSeller.toString()
        ),
        netAmountToSeller: parseFloat(
          auction.financialSummary.netAmountToSeller.toString()
        ),
        calculationDetails: auction.financialSummary.calculationDetails
          ? JSON.parse(auction.financialSummary.calculationDetails as string)
          : null,
        calculatedAt: auction.financialSummary.createdAt,
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

  /**
   * INTEGRATION POINT 2a: Get winner payment requirements
   * Called after auction finalization to emit payment details to winner
   *
   * SIMPLIFIED APPROACH:
   * - Financial summary already calculated by policy hub
   * - Just extract payment breakdown from existing data
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
          financialSummary: true,
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
        financialSummary: auction.financialSummary
          ? {
              netAmountToSeller: parseFloat(
                auction.financialSummary.netAmountToSeller.toString()
              ),
              totalCommission: parseFloat(
                auction.financialSummary.commissionFee.toString()
              ),
              totalCosts: parseFloat(
                auction.financialSummary.totalAuctionCosts.toString()
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
   * INTEGRATION POINT 2b: Initiate winner payment
   * Winner initiates payment after seeing requirements
   *
   * SIMPLIFIED APPROACH:
   * - Total amount already calculated above
   * - Directly invoke PaymentService.createPayment()
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

      // Directly invoke PaymentService.createPayment() - SIMPLIFIED!
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
   * INTEGRATION POINT 2c: Verify winner payment and prepare contract
   * Called after winner completes payment
   *
   * SIMPLIFIED APPROACH:
   * - Directly invoke PaymentService.verifyPayment()
   * - Update contract status after verification
   * - Pass info to contract generation feature
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

        // Get auction and winning bid info
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

        if (auction && auction.bids.length > 0) {
          const winningBid = auction.bids[0];

          // Calculate payment deadline (7 days after auction end)
          const paymentDeadline = new Date(auction.auctionEndAt);
          paymentDeadline.setDate(paymentDeadline.getDate() + 7);
          const now = new Date();

          // Check if deadline has passed
          if (now > paymentDeadline) {
            // Deadline expired - forfeit deposit and offer to 2nd highest bidder
            this.logger.error(
              `Winner payment deadline expired for auction ${auctionId}. Forfeiting deposit and offering to 2nd bidder.`
            );

            // Mark winning bid as forfeited
            await this.prisma.auctionBid.update({
              where: { id: winningBid.id },
              data: {
                isWinningBid: false,
                // TODO: Add metadata field to AuctionBid schema if needed
                // metadata: {
                //   ...((winningBid.metadata as any) || {}),
                //   depositForfeited: true,
                //   forfeitedReason: 'Payment deadline expired',
                //   forfeitedAt: new Date().toISOString(),
                // },
              },
            });

            // Update participant to reflect forfeiture (don't refund deposit)
            await this.prisma.auctionParticipant.update({
              where: { id: winningBid.participantId },
              data: {
                // TODO: Add metadata field to AuctionParticipant schema if needed
                // metadata: {
                //   depositForfeited: true,
                //   forfeitedReason: 'Winner payment deadline expired',
                //   forfeitedAt: new Date(),
                // },
              },
            });

            // Get 2nd highest bid
            const secondHighestBid = await this.prisma.auctionBid.findFirst({
              where: {
                auctionId,
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
              const requirements = await this.getWinnerPaymentRequirements(
                auctionId
              );
              await this.emailService.sendWinnerPaymentRequestEmail({
                recipientEmail: secondHighestBid.participant.user.email,
                recipientName: secondHighestBid.participant.user.fullName,
                auctionCode: auction.code,
                auctionName: auction.name,
                winningAmount:
                  requirements.paymentBreakdown.winningAmount.toLocaleString(),
                depositAlreadyPaid:
                  requirements.paymentBreakdown.depositAlreadyPaid.toLocaleString(),
                dossierFee:
                  requirements.paymentBreakdown.dossierFee.toLocaleString(),
                totalDue:
                  requirements.paymentBreakdown.totalDue.toLocaleString(),
                paymentDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              });

              this.logger.log(
                `Auction ${auctionId} offered to 2nd highest bidder ${secondHighestBid.participant.user.email}`
              );
            } else {
              // No 2nd bidder - mark auction as failed
              await this.prisma.auction.update({
                where: { id: auctionId },
                data: { status: AuctionStatus.no_bid },
              });

              this.logger.warn(
                `No 2nd bidder available for auction ${auctionId}. Auction marked as no_bid.`
              );
            }

            throw new BadRequestException(
              'Payment deadline has expired. Your deposit has been forfeited and the property has been offered to the next highest bidder.'
            );
          }

          // Deadline not expired - send failure notification email
          const totalDue = await this.getWinnerPaymentRequirements(auctionId);

          await this.emailService.sendPaymentFailureEmail({
            recipientEmail: winningBid.participant.user.email,
            recipientName: winningBid.participant.user.fullName,
            auctionCode: auction.code,
            auctionName: auction.name,
            paymentType: 'winning_payment',
            attemptedAmount:
              totalDue.paymentBreakdown.totalDue.toLocaleString(),
            failureReason: this.getPaymentFailureReason(verification.status),
            retryUrl: `${process.env.FRONTEND_URL}/auctions/${auctionId}/winner-payment/retry?paymentId=${payment.id}`,
            deadline: paymentDeadline,
          });

          // Track payment attempt
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: 'failed',
              // TODO: Add metadata field to Payment schema if needed
              // metadata: {
              //   ...((verification as any).metadata || {}),
              //   failureReason: verification.status,
              //   attemptedAt: new Date(),
              // },
            },
          });
        }

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
          seller: true,
          buyer: true,
        },
      });

      if (!contract) {
        throw new NotFoundException('Contract not found for this auction');
      }

      const updatedContract = await this.prisma.contract.update({
        where: { id: contract.id },
        data: {
          status: ContractStatus.signed, // Ready for final signatures
        },
      });

      this.logger.log(
        `Winner payment ${sessionId} (ID: ${payment.id}) verified. Contract ${contract.id} ready for signatures.`
      );

      // Send email notification to winner
      await this.emailService.sendWinnerPaymentConfirmedEmail({
        recipientEmail: contract.buyer.email,
        recipientName: contract.buyer.fullName,
        auctionCode: contract.auction.code,
        auctionName: contract.auction.name,
        totalPaid: verification.amount.toLocaleString(),
        contractReady: true,
      });

      // Send notification to seller
      await this.emailService.sendSellerPaymentNotificationEmail({
        recipientEmail: contract.seller.email,
        sellerName: contract.seller.fullName,
        buyerName: contract.buyer.fullName,
        auctionCode: contract.auction.code,
        auctionName: contract.auction.name,
        totalPaid: verification.amount.toLocaleString(),
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
          totalPaid: verification.amount.toLocaleString(),
          paidAt: new Date(),
          contractId: contract.id,
        })
      );

      // Send emails asynchronously
      Promise.allSettled(adminNotificationPromises).catch((err) => {
        this.logger.error(
          'Error sending admin winner payment notifications:',
          err
        );
      });

      this.logger.log(
        `Email notifications sent for winner payment ${sessionId} (ID: ${payment.id}): winner notified, seller notified, ${adminUsers.length} admin(s) notified`
      );

      // INTEGRATION POINT 3: Pass contract info to report/contract generation feature
      // This is where the contract generation module will take over
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
        // Data for contract generation module
        contractData: {
          auctionId,
          contractId: contract.id,
          seller: {
            userId: contract.sellerUserId,
            fullName: contract.seller.fullName,
            email: contract.seller.email,
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
      // TODO: Implement comprehensive error handling
      // - Payment gateway errors
      // - Network timeouts
      // - Duplicate payment verification
      // - Contract update failures
      // - Rollback strategy if contract update fails
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

      // Call the existing verification method (which will handle payment status update)
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
