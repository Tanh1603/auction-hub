import { ApiProperty } from '@nestjs/swagger';

export class Metadata {
  @ApiProperty()
  page: 1;
  @ApiProperty()
  limit: 10;
  @ApiProperty()
  total: number;
  @ApiProperty()
  totalPages: number;
}

export class ApiResponse<T> {
  @ApiProperty({ default: true })
  success: boolean;

  @ApiProperty({ required: false })
  message?: string;

  @ApiProperty({ required: false })
  data?: T;

  @ApiProperty({ required: false })
  meta?: Metadata;

  @ApiProperty({ example: new Date().toISOString() })
  timestamp: string;

  @ApiProperty({ example: '/api/v1/auctions' })
  path: string;
}

export class ApiResponseError {
  @ApiProperty({ default: true })
  success: false;
  @ApiProperty({ required: false })
  message: string | undefined;
  @ApiProperty({ required: false })
  errors: unknown;
  @ApiProperty()
  timestamp: string;
  @ApiProperty()
  path: string;
}
