import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddOtherCostDto {
  @ApiProperty({ example: 'Security personnel for 3 days' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 5000000 })
  @IsNumber()
  @Min(0)
  amount: number;
}
