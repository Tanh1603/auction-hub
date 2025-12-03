import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyDocumentsDto {
  @ApiProperty({
    description: 'ID of the registration record',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  registrationId: string;
}
