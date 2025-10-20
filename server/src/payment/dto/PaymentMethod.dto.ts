import { IsString, IsArray } from 'class-validator';

export class PaymentMethodDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  type: string;

  @IsArray()
  supported_cards: string[];
}

export class PaymentMethodsResponseDto {
  payment_methods: PaymentMethodDto[];
}

