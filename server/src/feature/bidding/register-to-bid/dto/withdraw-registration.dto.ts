import { IsUUID, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class WithdrawRegistrationDto {
  @ApiProperty({
    description: 'ID of the auction to withdraw registration from',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID('4')
  @IsNotEmpty()
  auctionId: string;

  @ApiProperty({
    description: 'Optional reason for withdrawal',
    example: 'Changed my mind about participating',
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  withdrawalReason?: string;
}
