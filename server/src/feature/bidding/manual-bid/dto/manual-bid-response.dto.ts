import type { BidType } from '../../../../../generated/index';

export class ManualBidResponseDto {
  bidId: string;
  auctionId: string;
  participantId: string;
  userId: string;
  amount: string;
  bidAt: Date;
  bidType: BidType;
}
