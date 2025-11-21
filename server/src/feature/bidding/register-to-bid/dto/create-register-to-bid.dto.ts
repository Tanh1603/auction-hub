import { IsUUID, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRegisterToBidDto {
  @ApiProperty({
    description: 'ID of the auction to register for',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID('4')
  @IsNotEmpty()
  auctionId: string;
}

/**
 * DTO for file upload in multipart/form-data format
 * Used with @ApiConsumes('multipart/form-data') in controller
 */
export class RegisterToBidFileUploadDto {
  @ApiProperty({
    description: 'ID of the auction to register for',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID('4')
  @IsNotEmpty()
  auctionId: string;

  @ApiPropertyOptional({
    type: 'array',
    items: {
      type: 'string',
      format: 'binary',
    },
    description: 'Array of document files (PDF, DOC, DOCX, etc.)',
  })
  documents?: any[];

  @ApiPropertyOptional({
    type: 'array',
    items: {
      type: 'string',
      format: 'binary',
    },
    description: 'Array of media files (images, videos)',
  })
  media?: any[];
}
