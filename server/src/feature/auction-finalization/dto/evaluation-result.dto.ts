import { AuctionStatus } from '../../../../generated';

export class EvaluationResultDto {
  auctionId: string;
  recommendedStatus: AuctionStatus;
  meetsReservePrice: boolean;
  hasMinimumParticipants: boolean;
  hasValidBids: boolean;
  totalValidBids: number;
  totalParticipants: number;
  highestBidAmount?: string;
  reservePrice?: string;
  minimumParticipants: number;
  bidIncrementCompliance: number; // Percentage (0-100)
  issues: string[];
  canFinalize: boolean;
  evaluatedAt: Date;
}
