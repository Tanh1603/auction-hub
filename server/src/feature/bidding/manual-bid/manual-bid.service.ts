import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { CreateManualBidDto } from './dto/create-manual-bid.dto';
import { DenyBidDto } from './dto/deny-bid.dto';
import { Prisma } from '../../../../generated';
import { PrismaService } from '../../../prisma/prisma.service';
import { ManualBidResponseDto } from './dto/manual-bid-response.dto';
import { BiddingGateway } from '../bidding.gateway';
import { AuctionStatus } from '../../../../generated';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ManualBidService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => BiddingGateway))
    private readonly biddingGateway: BiddingGateway
  ) {}

  async create(
    dto: CreateManualBidDto,
    userId: string
  ): Promise<ManualBidResponseDto> {
    // Load auction with participants and bids
    const auction = await this.prisma.auction.findUnique({
      where: { id: dto.auctionId },
      include: {
        participants: {
          where: { userId },
        },
        bids: {
          where: { isDenied: false, isWithdrawn: false },
          orderBy: { amount: 'desc' },
          take: 1,
        },
      },
    });

    if (!auction) {
      throw new NotFoundException('Auction not found');
    }

    // Check if auction is live
    if (auction.status !== AuctionStatus.live) {
      throw new ForbiddenException('Auction is not currently live');
    }

    // Check if auction session is active (within start and end time)
    const now = new Date();
    if (now < auction.auctionStartAt || now > auction.auctionEndAt) {
      throw new ForbiddenException('Auction session is not active');
    }

    // Check if user is registered as a participant
    const participant = auction.participants[0];
    if (!participant) {
      throw new ForbiddenException('You are not registered for this auction');
    }

    // Check if participant is confirmed (approved to bid)
    if (!participant.confirmedAt) {
      throw new ForbiddenException(
        'Your registration has not been confirmed yet'
      );
    }

    // Check if participant was rejected
    if (participant.rejectedAt) {
      throw new ForbiddenException(
        `Your registration was rejected: ${
          participant.rejectedReason || 'No reason provided'
        }`
      );
    }

    // Check if participant has checked in
    if (!participant.checkedInAt) {
      throw new ForbiddenException('You must check in before placing a bid');
    }

    // Check if participant has withdrawn
    if (participant.withdrawnAt) {
      throw new ForbiddenException('You have withdrawn from this auction');
    }

    // Convert bid amount to Decimal
    const bidAmount = new Decimal(dto.amount.toString());

    // Get current highest bid (excluding denied and withdrawn bids)
    const currentHighestBid = auction.bids[0]?.amount;
    const isFirstBid = !currentHighestBid;

    // Validate bid amount
    if (isFirstBid) {
      // First bid must be >= starting price
      if (bidAmount.lt(auction.startingPrice)) {
        throw new BadRequestException(
          `First bid must be at least the starting price of ${auction.startingPrice.toString()}`
        );
      }
    } else {
      // Subsequent bids must be > current highest bid
      if (bidAmount.lte(currentHighestBid)) {
        throw new BadRequestException(
          `Bid must be greater than the current highest bid of ${currentHighestBid.toString()}`
        );
      }
    }

    // Determine baseline for increment validation
    const baseline = isFirstBid ? auction.startingPrice : currentHighestBid;
    const delta = bidAmount.minus(baseline);

    // Validate bid increment
    if (!delta.mod(auction.bidIncrement).equals(0)) {
      throw new BadRequestException(
        `Incorrect bid increment. Bid must be in increments of ${auction.bidIncrement.toString()}`
      );
    }

    // Note: Reserve price validation would typically be done by the auctioneer
    // when they review bids, not during bid placement
    // However, if you want to enforce it here, you would need a reservePrice field on the Auction model

    // Use transaction to prevent race conditions
    const result = await this.prisma.$transaction(async (tx) => {
      // Recheck auction state within transaction
      const freshAuction = await tx.auction.findUnique({
        where: { id: auction.id },
        include: {
          bids: {
            where: { isDenied: false, isWithdrawn: false },
            orderBy: { amount: 'desc' },
            take: 1,
          },
        },
      });

      if (!freshAuction) {
        throw new NotFoundException('Auction not found');
      }

      // Revalidate auction is still live and active
      if (freshAuction.status !== AuctionStatus.live) {
        throw new ForbiddenException('Auction is no longer live');
      }

      const now2 = new Date();
      if (
        now2 < freshAuction.auctionStartAt ||
        now2 > freshAuction.auctionEndAt
      ) {
        throw new ForbiddenException('Auction session is no longer active');
      }

      // Revalidate bid amount against latest highest bid
      const latestHighestBid = freshAuction.bids[0]?.amount;
      const isStillFirstBid = !latestHighestBid;

      if (isStillFirstBid) {
        if (bidAmount.lt(freshAuction.startingPrice)) {
          throw new BadRequestException(
            `Bid must be at least the starting price of ${freshAuction.startingPrice.toString()}`
          );
        }
      } else {
        if (bidAmount.lte(latestHighestBid)) {
          throw new BadRequestException(
            `Bid must be greater than the current highest bid of ${latestHighestBid.toString()}`
          );
        }
      }

      // Mark all previous bids as non-winning
      await tx.auctionBid.updateMany({
        where: {
          auctionId: freshAuction.id,
          isWinningBid: true,
        },
        data: { isWinningBid: false },
      });

      // Create the bid record (for audit trail) as winning bid
      const savedBid = await tx.auctionBid.create({
        data: {
          auctionId: freshAuction.id,
          participantId: participant.id,
          amount: bidAmount,
          bidAt: new Date(),
          bidType: 'manual',
          isWinningBid: true,
        },
      });

      return {
        bidId: savedBid.id,
        auctionId: freshAuction.id,
        participantId: participant.id,
        userId,
        amount: bidAmount.toString(),
        bidAt: savedBid.bidAt,
        bidType: savedBid.bidType,
        isWinningBid: true,
      } as ManualBidResponseDto;
    });

    // Emit WebSocket event for new bid with full auction state
    // This will broadcast the updated winning bid and auction state to all connected clients
    await this.biddingGateway.emitNewBidWithState(result.auctionId);

    return result;
  }

  async denyBid(dto: DenyBidDto, auctioneerId: string) {
    // Find the bid with its auction and participant details
    const bid = await this.prisma.auctionBid.findUnique({
      where: { id: dto.bidId },
      include: {
        auction: true,
        participant: true,
      },
    });

    if (!bid) {
      throw new NotFoundException('Bid not found');
    }

    // Fetch the user to check their role
    const user = await this.prisma.user.findUnique({
      where: { id: auctioneerId },
      select: { role: true },
    });

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    // Verify that the user is the auction owner (auctioneer) OR an admin/super admin
    const isOwner = bid.auction.propertyOwner === auctioneerId;
    const isAdminOrSuperAdmin = user.role === 'admin' || user.role === 'super_admin';

    if (!isOwner && !isAdminOrSuperAdmin) {
      throw new ForbiddenException(
        'Only the auction owner, admin, or super admin can deny bids'
      );
    }

    // Check if bid is already denied
    if (bid.isDenied) {
      throw new BadRequestException('Bid has already been denied');
    }

    // Check if bid is already withdrawn
    if (bid.isWithdrawn) {
      throw new BadRequestException('Cannot deny a withdrawn bid');
    }

    // Update the bid to mark it as denied
    const deniedBid = await this.prisma.auctionBid.update({
      where: { id: dto.bidId },
      data: {
        isDenied: true,
        deniedAt: new Date(),
        deniedBy: auctioneerId,
        deniedReason: dto.reason || 'Bid denied by auctioneer',
      },
    });

    const result = {
      bidId: deniedBid.id,
      auctionId: deniedBid.auctionId,
      participantId: deniedBid.participantId,
      isDenied: deniedBid.isDenied,
      deniedAt: deniedBid.deniedAt,
      deniedBy: deniedBid.deniedBy,
      deniedReason: deniedBid.deniedReason,
    };

    // Emit WebSocket event for denied bid
    this.biddingGateway.emitBidDenied(result.auctionId, {
      bidId: result.bidId,
      auctionId: result.auctionId,
      participantId: result.participantId,
      isDenied: result.isDenied,
      deniedAt: result.deniedAt,
      deniedBy: result.deniedBy,
      deniedReason: result.deniedReason,
    });

    return result;
  }
}
