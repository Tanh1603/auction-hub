import { Decimal, JsonValue } from '../../../generated/runtime/library';
import { PropertyOwnerDto } from './create-auction.dto';

export class LocationDto {
  id: number;
  name: string;
  value: number;
  sortOrder: number;
}

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

  propertyOwner: PropertyOwnerDto;

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

  assetProvince: LocationDto;

  assetWard: LocationDto;
}
