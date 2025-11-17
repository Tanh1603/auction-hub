import { IsString, IsNumber, IsObject } from 'class-validator';

export class PaymentVerificationDto {
  @IsString()
  payment_id: string;

  @IsString()
  status: string;

  @IsNumber()
  amount: number;

  @IsString()
  currency: string;

  @IsObject()
  metadata: Record<string, string>;
}

