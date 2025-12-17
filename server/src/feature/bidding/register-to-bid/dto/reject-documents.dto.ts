import { IsNotEmpty, IsUUID, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectDocumentsDto {
  @ApiProperty({
    description: 'ID of the registration record',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  registrationId: string;

  @ApiProperty({
    description: 'Reason for rejecting the documents',
    example:
      'Identity card is not clear. Please upload a higher quality image.',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
