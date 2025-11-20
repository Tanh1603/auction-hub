import { Decimal, JsonValue } from '../../../generated/runtime/library';

export class AuctionDetailDto {
  id: string;
  code: string;
  name: string;
  status: string;
  assetType: string;
  assetAddress: string;
  assetDescription: string;
  viewTime: string;

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
    avatarUrl: string;
  };

  images: JsonValue;
  attachments: JsonValue;
  relatedAuctions: {
    id: string;
    name: string;
    images: JsonValue;
    startingPrice: Decimal;
    depositAmountRequired: Decimal;
    saleStartAt: Date;
  }[];
}
