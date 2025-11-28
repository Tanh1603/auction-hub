import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { AssetType, Prisma } from '../../../generated';
import { Decimal } from '../../../generated/runtime/library';
import { CloudinaryResponse } from '../../cloudinary/cloudinary-response';

export class PropertyOwnerDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  name: string;

  @IsNotEmpty()
  @IsEmail()
  @ApiProperty()
  email: string;

  @Matches(/^[0-9]{9,15}$/, {
    message: 'Phone must be a valid number with 9-15 digits',
  })
  @ApiProperty()
  phone: string;

  @IsOptional()
  @IsString()
  @ApiProperty()
  organization?: string;
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

  @IsInt()
  @IsNotEmpty()
  @ApiProperty({ type: Number, required: true })
  assetWardId: number;

  @IsInt()
  @IsNotEmpty()
  @ApiProperty({ type: Number, required: true })
  assetProvinceId: number;

  @ValidateNested({ each: true })
  @Type(() => CloudinaryResponse)
  @ApiProperty({
    type: CloudinaryResponse,
    required: true,
    isArray: true,
  })
  @IsArray()
  images: Prisma.InputJsonValue[];

  @ValidateNested({ each: true })
  @Type(() => CloudinaryResponse)
  @IsArray()
  @ApiProperty({
    type: CloudinaryResponse,
    required: true,
    isArray: true,
  })
  attachments: Prisma.InputJsonValue[];

  @IsObject()
  @IsNotEmpty()
  @ApiProperty({
    type: PropertyOwnerDto,
    required: true,
  })
  @ValidateNested()
  @Type(() => PropertyOwnerDto)
  propertyOwner: Prisma.InputJsonValue;
}
