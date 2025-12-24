import type { ContractStatus } from '../../../generated';

export class ContractDetailDto {
  id: string;
  auctionId: string;
  auctionName: string;
  auctionCode: string;
  winningBidId: string;
  sellerUserId: string;
  sellerName: string;
  sellerIdentityNumber?: string;
  buyerUserId: string;
  buyerName: string;
  buyerIdentityNumber?: string;
  createdBy: string;
  creatorName: string;
  creatorIdentityNumber?: string;
  price: number;
  status: ContractStatus;
  signedAt?: Date;
  cancelledAt?: Date;
  docUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ContractListItemDto {
  id: string;
  auctionName: string;
  auctionCode: string;
  sellerName: string;
  buyerName: string;
  price: number;
  status: ContractStatus;
  signedAt?: Date;
  createdAt: Date;
}
