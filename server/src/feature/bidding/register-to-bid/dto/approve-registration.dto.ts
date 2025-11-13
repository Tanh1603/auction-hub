import { IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApproveRegistrationDto {
  @ApiProperty({
    description: 'ID of the auction participant registration to approve',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID('4')
  @IsNotEmpty()
  participantId: string;
}
