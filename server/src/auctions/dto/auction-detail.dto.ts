import { Decimal } from '@prisma/client/runtime/library';

export class AuctionDetailDto {
  id: string;
  code: string;
  name: string;
  status: string;
  assetType: string;
  assetAddress: string;
  assetDescription: string;

  saleStartAt: Date;
  saleEndAt: Date;
  auctionStartAt: Date;
  auctionEndAt: Date;
  depositEndAt: Date;

  startingPrice: Decimal;
  bidIncrement: Decimal;
  depositAmountRequired: Decimal;
  saleFee: Decimal;

  owner: {
    id: string;
    fullName: string;
    email: string;
  };

  images: { url: string; sortOrder: number }[];
  attachments: { url: string; type: string }[];
  related: { id: string; name: string; code: string }[];

  participantCount: number;
  bidCount: number;
  highestBid?: Decimal;
}
