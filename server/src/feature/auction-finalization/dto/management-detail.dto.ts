/**
 * Management Detail DTO - Secure internal view for admin override operations
 * This provides the full bidding pool and participant status needed for manual winner selection
 */

export interface BidSummaryDto {
  bidId: string;
  participantId: string;
  amount: string;
  bidAt: Date;
  bidType: string;
  isWinningBid: boolean;
  isDenied: boolean;
  isWithdrawn: boolean;
  deniedReason?: string;
  participant: {
    userId: string;
    fullName: string;
    email: string;
    depositPaid: boolean;
    checkedIn: boolean;
    isDisqualified: boolean;
  };
}

export interface ParticipantSummaryDto {
  participantId: string;
  userId: string;
  fullName: string;
  email: string;
  registeredAt: Date;
  confirmedAt: Date | null;
  checkedInAt: Date | null;
  depositPaidAt: Date | null;
  depositAmount: string | null;
  isDisqualified: boolean;
  disqualifiedReason: string | null;
  withdrawnAt: Date | null;
  totalBids: number;
  highestBidAmount: string | null;
}

export interface ManagementDetailDto {
  // Core auction info
  auctionId: string;
  auctionCode: string;
  auctionName: string;
  status: string;

  // Key dates
  auctionStartAt: Date;
  auctionEndAt: Date;
  depositEndAt: Date;

  // Pricing info (important for admin decisions)
  startingPrice: string;
  reservePrice: string | null;
  bidIncrement: string;
  currentHighestBid: string | null;

  // Bidding pool - all bids sorted by amount desc
  bids: BidSummaryDto[];

  // Participant pool - all participants with their status
  participants: ParticipantSummaryDto[];

  // Current state
  currentWinningBid: BidSummaryDto | null;

  // Evaluation summary
  evaluation: {
    meetsReservePrice: boolean;
    hasMinimumParticipants: boolean;
    hasValidBids: boolean;
    recommendedStatus: string;
    issues: string[];
  } | null;

  // Contract info if exists
  contract: {
    contractId: string;
    status: string;
    createdAt: Date;
  } | null;

  // Summary counts
  summary: {
    totalBids: number;
    validBids: number;
    deniedBids: number;
    totalParticipants: number;
    checkedInParticipants: number;
    depositPaidParticipants: number;
    disqualifiedParticipants: number;
  };
}
