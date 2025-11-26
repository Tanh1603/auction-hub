import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuctionEvaluationService } from './auction-evaluation.service';
import { AuctionResultDto } from '../dto/auction-result.dto';
import { AuctionStatus } from '../../../../generated';

/**
 * Service responsible for viewing auction results
 * Context: Participants and Auction Viewers
 */
@Injectable()
export class AuctionResultsService {
  private readonly logger = new Logger(AuctionResultsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly evaluationService: AuctionEvaluationService
  ) {}

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
      const evaluation = await this.evaluationService.evaluateAuction(
        auctionId
      );
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
    if (auction.finalSalePrice) {
      result.financialSummary = {
        finalSalePrice: parseFloat(auction.finalSalePrice.toString()),
        startingPrice: parseFloat(
          auction.startingPriceSnapshot?.toString() ||
            auction.startingPrice.toString()
        ),
        commissionFee: parseFloat(auction.commissionFee.toString()),
        dossierFee: parseFloat(
          auction.dossierFeeSnapshot?.toString() ||
            auction.dossierFee?.toString() ||
            '0'
        ),
        depositAmount: parseFloat(
          auction.depositAmountSnapshot?.toString() ||
            auction.depositAmountRequired.toString()
        ),
        totalAuctionCosts: parseFloat(
          auction.totalAuctionCosts?.toString() || '0'
        ),
        totalFeesToSeller: parseFloat(
          auction.totalFeesToPropertyOwner?.toString() || '0'
        ),
        netAmountToSeller: parseFloat(
          auction.netAmountToPropertyOwner?.toString() || '0'
        ),
        calculationDetails: auction.calculationDetails
          ? JSON.parse(auction.calculationDetails as string)
          : null,
        calculatedAt: auction.financialCalculatedAt || auction.updatedAt,
      };
    }

    return result;
  }
}
