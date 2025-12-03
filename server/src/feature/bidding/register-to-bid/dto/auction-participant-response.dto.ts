import { ApiProperty } from '@nestjs/swagger';

export class AuctionParticipantResponseDto {
  @ApiProperty({
    description: 'Participant record ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'User ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  userId: string;

  @ApiProperty({
    description: 'Auction ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  auctionId: string;

  @ApiProperty({
    description: 'When user initiated registration',
    example: '2024-10-23T10:00:00Z',
  })
  registeredAt: Date | null;

  @ApiProperty({
    description: 'When documents were submitted',
    example: '2024-10-23T10:05:00Z',
  })
  submittedAt: Date | null;

  @ApiProperty({
    description: 'When admin confirmed registration',
    example: '2024-10-23T15:30:00Z',
  })
  confirmedAt: Date | null;

  @ApiProperty({
    description: 'When admin rejected registration',
    example: null,
  })
  rejectedAt: Date | null;

  @ApiProperty({
    description: 'Reason for rejection if applicable',
    example: 'Documentation incomplete',
  })
  rejectedReason: string | null;

  @ApiProperty({
    description: 'When user checked in for auction',
    example: null,
  })
  checkedInAt: Date | null;

  @ApiProperty({
    description: 'When user withdrew from auction',
    example: null,
  })
  withdrawnAt: Date | null;

  @ApiProperty({
    description: 'Reason for withdrawal if applicable',
    example: 'Changed my mind about participating',
  })
  withdrawalReason: string | null;

  @ApiProperty({
    description: 'Derived current state from timestamps',
    enum: [
      'REGISTERED',
      'PENDING_REVIEW',
      'CONFIRMED',
      'REJECTED',
      'CHECKED_IN',
      'WITHDRAWN',
      'UNKNOWN',
    ],
    example: 'PENDING_REVIEW',
  })
  currentState: string;
}
