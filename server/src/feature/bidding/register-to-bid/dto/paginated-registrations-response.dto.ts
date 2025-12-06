import { ApiProperty } from '@nestjs/swagger';
import { AuctionParticipantResponseDto } from './auction-participant-response.dto';

export class PaginationMetadata {
  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  currentPage: number;

  @ApiProperty({
    description: 'Items per page',
    example: 10,
  })
  pageSize: number;

  @ApiProperty({
    description: 'Total number of items',
    example: 50,
  })
  totalItems: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 5,
  })
  totalPages: number;

  @ApiProperty({
    description: 'Whether there is a next page',
    example: true,
  })
  hasNextPage: boolean;

  @ApiProperty({
    description: 'Whether there is a previous page',
    example: false,
  })
  hasPreviousPage: boolean;
}

export class ParticipantWithUserInfo extends AuctionParticipantResponseDto {
  @ApiProperty({
    description: 'User information',
    example: {
      email: 'user@example.com',
      fullName: 'John Doe',
      phoneNumber: '+1234567890',
    },
  })
  user: {
    email: string;
    fullName: string;
    phoneNumber: string | null;
  };

  @ApiProperty({
    description: 'Auction information',
    example: {
      name: 'Property Auction #123',
      code: 'AUC-2024-001',
    },
  })
  auction: {
    name: string;
    code: string;
  };
}

export class PaginatedRegistrationsResponseDto {
  @ApiProperty({
    description: 'List of registrations',
    type: [ParticipantWithUserInfo],
  })
  data: ParticipantWithUserInfo[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationMetadata,
  })
  pagination: PaginationMetadata;
}
