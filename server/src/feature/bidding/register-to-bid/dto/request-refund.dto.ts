import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RequestRefundDto {
  @ApiProperty({
    description: 'ID of the auction to request refund for',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  auctionId: string;

  @ApiPropertyOptional({
    description: 'Reason for requesting the refund',
    example: 'Changed my mind about participating',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
