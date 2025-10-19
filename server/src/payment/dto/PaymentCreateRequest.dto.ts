import { IsNotEmpty, IsEnum, IsUUID, IsDecimal, IsPositive } from 'class-validator';

export enum PaymentType {
    deposit = 'deposit',
    participation_fee = 'participation_fee',
    winning_payment = 'winning_payment',
    refund = 'refund',
  }   

export enum PaymentMethod {
  bank_transfer = 'bank_transfer',
  e_wallet = 'e_wallet',
  cash = 'cash',
}

export class PaymentCreateRequestDto {
  @IsUUID()
  @IsNotEmpty({ message: 'Auction ID is required' })
  auctionId: string;

  @IsUUID()
  @IsNotEmpty({ message: 'Registration ID is required' })
  registrationId: string;

  @IsNotEmpty({ message: 'Payment type is required' })
  @IsEnum(PaymentType, { message: 'Invalid payment type' })
  paymentType: PaymentType;

  @IsNotEmpty({ message: 'Amount is required' })
  @IsDecimal()
  @IsPositive({ message: 'Amount must be greater than 0' })
  amount: number;

  @IsNotEmpty({ message: 'Payment method is required' })
  @IsEnum(PaymentMethod, { message: 'Invalid payment method' })
  paymentMethod: PaymentMethod;
}

