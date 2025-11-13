import { IsOptional, IsInt, Min, IsEnum, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum RegistrationStatus {
  ALL = 'all',
  PENDING_REVIEW = 'pending_review',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn',
}

export class ListRegistrationsQueryDto {
  @ApiProperty({
    description: 'Page number (starts from 1)',
    example: 1,
    required: false,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10,
    required: false,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiProperty({
    description: 'Filter by registration status',
    enum: RegistrationStatus,
    required: false,
    default: RegistrationStatus.ALL,
  })
  @IsOptional()
  @IsEnum(RegistrationStatus)
  status?: RegistrationStatus = RegistrationStatus.ALL;

  @ApiProperty({
    description: 'Filter by specific auction ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  auctionId?: string;
}
