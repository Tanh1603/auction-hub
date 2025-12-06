import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EvaluationResultDto } from '../dto/evaluation-result.dto';
import { AuctionStatus } from '../../../../generated';

/**
 * Service responsible for evaluating auction status based on business rules
 * Context: System/Automated Evaluation
 */
@Injectable()
export class AuctionEvaluationService {
  private readonly logger = new Logger(AuctionEvaluationService.name);

  // Configuration - can be moved to environment variables or database
  private readonly MINIMUM_PARTICIPANTS = 2;
  private readonly MINIMUM_BID_INCREMENT_COMPLIANCE = 0.95; // 95% of bids must follow increment rules

  constructor(private readonly prisma: PrismaService) {}

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
}
