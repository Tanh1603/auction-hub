import { IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
