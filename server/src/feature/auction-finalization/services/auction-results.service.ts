import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuctionEvaluationService } from './auction-evaluation.service';
import { AuctionResultDto } from '../dto/auction-result.dto';
import { getPropertyOwnerId } from '../../../common/types/property-owner-snapshot.interface';

/**
 * Access level enum for tiered access control
 */
enum AccessLevel {
  // Full access - can see everything including winner's email
  FULL = 'full',
  // Participant access - can see all data but winner's name is hidden
  PARTICIPANT = 'participant',
  // Public access - limited data only (for finalized auctions)
  PUBLIC = 'public',
  // No access - should be rejected
  NONE = 'none',
}

// Statuses that are considered "finalized" and can be viewed publicly
const FINALIZED_STATUSES = ['success', 'failed'];

/**
 * Service responsible for viewing auction results with tiered access control
 *
 * Access Levels:
 * - FULL: Admin, Super Admin, Property Owner (auctioneer)
 * - PARTICIPANT: Authenticated bidders who participated in the auction
 * - PUBLIC: Unauthenticated users (limited data, finalized auctions only)
 */
@Injectable()
export class AuctionResultsService {
  private readonly logger = new Logger(AuctionResultsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly evaluationService: AuctionEvaluationService
  ) {}

  /**
   * Get auction results with tiered access control
   * @param auctionId - The auction ID
   * @param userId - The user ID (null if unauthenticated)
   * @param userRole - The user role (null if unauthenticated)
   */
  async getAuctionResults(
    auctionId: string,
    userId: string | null,
    userRole: string | null
  ): Promise<AuctionResultDto> {
    // Fetch auction with related data
    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        participants: userId
          ? {
              where: { userId },
            }
          : false,
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

    // Determine access level
    const accessLevel = this.determineAccessLevel(auction, userId, userRole);

    this.logger.debug(
      `Access level for user ${
        userId || 'anonymous'
      } on auction ${auctionId}: ${accessLevel}`
    );

    // Validate access
    if (accessLevel === AccessLevel.NONE) {
      throw new ForbiddenException(
        'Auction results are not yet available for public viewing'
      );
    }

    // Build response based on access level
    return this.buildAuctionResultDto(auction, userId, accessLevel);
  }

  /**
   * Determine the access level for a user viewing auction results
   */
  private determineAccessLevel(
    auction: any,
    userId: string | null,
    userRole: string | null
  ): AccessLevel {
    // Admin/Super Admin always gets full access
    if (userRole === 'admin' || userRole === 'super_admin') {
      return AccessLevel.FULL;
    }

    // Property owner (auctioneer) gets full access to their auctions
    const ownerId = getPropertyOwnerId(auction.propertyOwner);
    if (userId && ownerId === userId) {
      return AccessLevel.FULL;
    }

    // Check if user is a participant
    const isParticipant =
      auction.participants && auction.participants.length > 0;

    if (userId && isParticipant) {
      return AccessLevel.PARTICIPANT;
    }

    // Public access - only for finalized auctions
    const isFinalized = FINALIZED_STATUSES.includes(auction.status);
    if (isFinalized) {
      return AccessLevel.PUBLIC;
    }

    // Authenticated but not participant, and auction not finalized
    if (userId) {
      // Allow authenticated users to see some data even if not participant
      // but only for finalized auctions
      return AccessLevel.NONE;
    }

    // Unauthenticated and auction not finalized
    return AccessLevel.NONE;
  }

  /**
   * Build the auction result DTO based on access level
   */
  private async buildAuctionResultDto(
    auction: any,
    userId: string | null,
    accessLevel: AccessLevel
  ): Promise<AuctionResultDto> {
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

    // Base result - available to all access levels
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
      // Indicate access level to frontend
      accessLevel: accessLevel,
    };

    // PUBLIC access: Only basic info + limited winning bid info
    if (accessLevel === AccessLevel.PUBLIC) {
      const winningBid = auction.bids[0];
      if (winningBid) {
        result.winningBid = {
          bidId: winningBid.id,
          amount: winningBid.amount.toString(),
          bidAt: winningBid.bidAt,
          bidType: winningBid.bidType,
          winner: {
            userId: '[HIDDEN]',
            fullName: '[HIDDEN]',
            email: '[HIDDEN]',
          },
        };
      }

      // Include basic financial summary for public (no sensitive data)
      if (auction.finalSalePrice) {
        result.financialSummary = {
          finalSalePrice: parseFloat(auction.finalSalePrice.toString()),
          startingPrice: parseFloat(
            auction.startingPriceSnapshot?.toString() ||
              auction.startingPrice.toString()
          ),
          // Hide detailed fees from public
          commissionFee: 0,
          dossierFee: 0,
          depositAmount: 0,
          totalAuctionCosts: 0,
          totalFeesToSeller: 0,
          netAmountToSeller: 0,
          calculationDetails: null,
          calculatedAt: auction.financialCalculatedAt || auction.updatedAt,
        };
      }

      return result;
    }

    // PARTICIPANT and FULL access: Include bid history and evaluation
    const allValidBids = await this.prisma.auctionBid.findMany({
      where: {
        auctionId: auction.id,
        isDenied: false,
        isWithdrawn: false,
      },
      orderBy: { amount: 'desc' },
      include: {
        participant: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
      },
      take: 50, // Limit to top 50 recent bids
    });

    // Get evaluation if available
    let evaluationData = null;
    try {
      const evaluation = await this.evaluationService.evaluateAuction(
        auction.id
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
      this.logger.error(`Failed to evaluate auction ${auction.id}:`, error);
    }

    result.evaluation = evaluationData;

    // Populate allBids with hidden or visible names based on access level
    result.allBids = allValidBids.map((bid) => ({
      bidId: bid.id,
      amount: bid.amount.toString(),
      bidAt: bid.bidAt,
      bidType: bid.bidType,
      isWinningBid: bid.isWinningBid,
      // PARTICIPANT access: Hide winner's name, show others
      // FULL access: Show all names
      bidderName:
        accessLevel === AccessLevel.FULL
          ? bid.participant.user.fullName
          : bid.isWinningBid
          ? '[WINNER - HIDDEN]'
          : bid.participant.user.fullName,
    }));

    // Populate userBids (Personal history) - only for authenticated users
    if (userId) {
      result.userBids = allValidBids
        .filter((bid) => bid.participant.user.id === userId)
        .map((bid) => ({
          bidId: bid.id,
          amount: bid.amount.toString(),
          bidAt: bid.bidAt,
          bidType: bid.bidType,
          isWinningBid: bid.isWinningBid,
          participantId: bid.participantId,
          bidderName: bid.participant.user.fullName,
        }));
    }

    // Winning bid info
    const winningBid = auction.bids[0];
    if (winningBid) {
      result.winningBid = {
        bidId: winningBid.id,
        amount: winningBid.amount.toString(),
        bidAt: winningBid.bidAt,
        bidType: winningBid.bidType,
        winner:
          accessLevel === AccessLevel.FULL
            ? {
                userId: winningBid.participant.user.id,
                fullName: winningBid.participant.user.fullName,
                email: winningBid.participant.user.email,
              }
            : {
                // PARTICIPANT access: Hide winner info
                userId: '[HIDDEN]',
                fullName: '[HIDDEN]',
                email: '[HIDDEN]',
              },
      };
    }

    // Contract info - available to PARTICIPANT and FULL
    const contract = auction.contracts[0];
    if (contract) {
      result.contract = {
        contractId: contract.id,
        status: contract.status,
        createdAt: contract.createdAt,
      };
    }

    // Financial summary - FULL access gets everything, PARTICIPANT gets limited
    if (auction.finalSalePrice) {
      if (accessLevel === AccessLevel.FULL) {
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
      } else {
        // PARTICIPANT access: Show basic financial info only
        result.financialSummary = {
          finalSalePrice: parseFloat(auction.finalSalePrice.toString()),
          startingPrice: parseFloat(
            auction.startingPriceSnapshot?.toString() ||
              auction.startingPrice.toString()
          ),
          commissionFee: 0, // Hidden
          dossierFee: 0, // Hidden
          depositAmount: parseFloat(
            auction.depositAmountSnapshot?.toString() ||
              auction.depositAmountRequired.toString()
          ),
          totalAuctionCosts: 0, // Hidden
          totalFeesToSeller: 0, // Hidden
          netAmountToSeller: 0, // Hidden
          calculationDetails: null, // Hidden
          calculatedAt: auction.financialCalculatedAt || auction.updatedAt,
        };
      }
    }

    return result;
  }
}
