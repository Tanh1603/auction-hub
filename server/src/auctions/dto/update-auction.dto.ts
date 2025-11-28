import { PartialType } from '@nestjs/mapped-types';
import { CreateAuctionDto } from './create-auction.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateAuctionDto extends PartialType(CreateAuctionDto) {
  @ApiPropertyOptional({ description: 'Auction active status' })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;
}

export class UpdateAuctionRelationsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ApiProperty({
    type: [String],
    required: true,
  })
  relatedIds: string[];
}
