import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';
import { CreateAuctionDto } from './create-auction.dto';

export class UpdateAuctionDto extends PartialType(CreateAuctionDto) {}

export class UpdateAuctionRelationsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ApiProperty({
    type: [String],
    required: true,
  })
  relatedIds: string[];
}
