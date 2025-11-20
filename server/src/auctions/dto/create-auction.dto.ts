import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { AssetType } from '../../../generated';
import { Decimal } from '../../../generated/runtime/library';

export class ImageDto {
  @IsNotEmpty()
  publicId: string;

  @IsNotEmpty()
  url: string;

  @IsNotEmpty()
  sortOrder: number;
}

export class AttachmentDto {
  @IsNotEmpty()
  publicId: string;

  @IsNotEmpty()
  url: string;
}

export class CreateAuctionDto {
  @ApiProperty({ description: 'Auction code' })
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: 'Auction asset name' })
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Asset type', enum: AssetType })
  @IsEnum(AssetType)
  @IsNotEmpty()
  assetType: AssetType;

  @ApiProperty({ description: 'Asset address' })
  @IsNotEmpty()
  assetAddress: string;

  @ApiProperty({
    description: 'Asset description',
  })
  @IsNotEmpty()
  assetDescription: string;

  @ApiProperty({
    description: 'Start date of selling documents',
    type: String,
    format: 'date-time',
  })
  @IsDate()
  @Type(() => Date)
  saleStartAt: Date;

  @ApiProperty({
    description: 'End date of selling documents',
    type: String,
    format: 'date-time',
  })
  @IsDate()
  @Type(() => Date)
  saleEndAt: Date;

  @ApiProperty({
    description: 'Auction start date',
    type: String,
    format: 'date-time',
  })
  @IsDate()
  @Type(() => Date)
  auctionStartAt: Date;

  @ApiProperty({
    description: 'Auction end date',
    type: String,
    format: 'date-time',
  })
  @IsDate()
  @Type(() => Date)
  auctionEndAt: Date;

  @ApiProperty({
    description: 'Deposit deadline',
    type: String,
    format: 'date-time',
  })
  @IsDate()
  @Type(() => Date)
  depositEndAt: Date;

  @ApiProperty({ description: 'Starting price', type: Number })
  @IsNotEmpty()
  @Transform(({ value }) => (value ? new Decimal(value) : value))
  startingPrice: Decimal;

  @ApiProperty({ description: 'Bid increment', type: Number })
  @IsNotEmpty()
  @Transform(({ value }) => (value ? new Decimal(value) : value))
  bidIncrement: Decimal;

  @ApiProperty({ description: 'Required deposit amount', type: Number })
  @IsNotEmpty()
  @Transform(({ value }) => (value ? new Decimal(value) : value))
  depositAmountRequired: Decimal;

  @ApiProperty({ description: 'Sale participation fee', type: Number })
  @IsNotEmpty()
  @Transform(({ value }) => (value ? new Decimal(value) : value))
  saleFee: Decimal;

  @ApiProperty({ description: 'Asset viewing schedule' })
  @IsNotEmpty()
  viewTime: string;

  @ApiProperty({
    description: 'Minutes allowed to check in before auction starts',
    type: Number,
  })
  @IsNotEmpty()
  @Transform(({ value }) => (value ? Number(value) : value))
  validCheckInBeforeStartMinutes: number;

  @ApiProperty({
    description: 'Minutes allowed to check in after auction starts',
    type: Number,
  })
  @IsNotEmpty()
  @Transform(({ value }) => (value ? Number(value) : value))
  validCheckInAfterStartMinutes: number;

  @ApiProperty({ description: 'Property owner ID', type: String })
  @IsUUID()
  propertyOwnerId: string;

  @ApiPropertyOptional({
    description: 'List of related auction IDs',
    type: [String],
  })
  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return [];
    try {
      return typeof value === 'string' ? JSON.parse(value) : value;
    } catch {
      return [];
    }
  })
  relatedAuctions?: string[];
}
