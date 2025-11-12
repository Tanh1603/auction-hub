import { IsString, MinLength } from 'class-validator';

export class CancelContractDto {
  @IsString()
  @MinLength(6, { message: 'Cancellation reason must be at least 6 characters long' })
  reason: string;
}

