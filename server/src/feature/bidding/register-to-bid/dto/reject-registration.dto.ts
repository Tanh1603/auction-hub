import { IsUUID, IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectRegistrationDto {
  @ApiProperty({
    description: 'ID of the auction participant registration to reject',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID('4')
  @IsNotEmpty()
  participantId: string;

  @ApiProperty({
    description: 'Reason for rejecting the registration',
    example: 'Incomplete documentation provided',
    required: false,
  })
  @IsString()
  @IsOptional()
  rejectionReason?: string;
}
