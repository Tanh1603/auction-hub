import { IsUUID, IsNotEmpty, IsArray, IsOptional, IsUrl, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class DocumentUpload {
  @ApiProperty({ example: 'identity_card', description: 'Type of document' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ example: 'https://example.com/documents/id-card.pdf', description: 'URL to the uploaded document' })
  @IsUrl()
  @IsNotEmpty()
  url: string;
}

export class CreateRegisterToBidDto {
  @ApiProperty({
    description: 'ID of the auction to register for',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID('4')
  @IsNotEmpty()
  auctionId: string;

  @ApiPropertyOptional({
    type: [DocumentUpload],
    description: 'Array of document uploads with type and URL',
    example: [
      { type: 'identity_card', url: 'https://example.com/documents/id-card.pdf' },
      { type: 'business_license', url: 'https://example.com/documents/license.pdf' }
    ],
  })
  @IsArray()
  @IsOptional()
  @Type(() => DocumentUpload)
  documentUrls?: DocumentUpload[];
}
