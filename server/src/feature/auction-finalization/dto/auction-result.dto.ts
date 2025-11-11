import { AuctionStatus, BidType } from '../../../../generated';

export class AuctionResultDto {
  auctionId: string;
  auctionCode: string;
  auctionName: string;
  status: AuctionStatus;
  startingPrice: string;
  auctionStartAt: Date;
  auctionEndAt: Date;
  finalizedAt?: Date;

  // Winning bid information
  winningBid?: {
    bidId: string;
    amount: string;
    bidAt: Date;
    bidType: BidType;
    winner: {
      userId: string;
      fullName: string;
      email: string;
    };
  };

  // Auction statistics
  totalBids: number;
  totalParticipants: number;

  // Contract information (if created)
  contract?: {
    contractId: string;
    status: string;
    createdAt: Date;
  };

  // Evaluation details
  evaluation?: {
    meetsReservePrice: boolean;
    hasMinimumParticipants: boolean;
    hasValidBids: boolean;
    bidIncrementCompliance: number; // Percentage (0-100)
    autoEvaluated: boolean;
    evaluatedAt: Date;
  };
}
