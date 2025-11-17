import { IsNotEmpty, IsUUID, IsNumber, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitDepositDto {
  @ApiProperty({
    description: 'ID of the registration record',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  registrationId: string;

  @ApiProperty({
    description: 'ID of the auction',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  auctionId: string;

  @ApiProperty({
    description: 'Amount of deposit to pay',
    example: 50000000,
  })
  @IsNumber()
  @IsPositive()
  amount: number;
}
