import { IsString, IsUUID, IsNumber, IsOptional, IsUrl, IsDateString, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class BankInfoDto {
  @IsString()
  bank_name: string;

  @IsString()
  account_number: string;

  @IsString()
  account_name: string;

  @IsString()
  transfer_content: string;
}

export class Payment {
  @IsUUID()
  payment_id: string;

  @IsNumber()
  amount: number;

  @IsString()
  currency: string;

  @IsString()
  status: string;

  @IsOptional()
  @IsUrl()
  payment_url?: string | null;

  @IsOptional()
  @IsUrl()
  qr_code?: string | null;

  @IsObject()
  @ValidateNested()
  @Type(() => BankInfoDto)
  bank_info: BankInfoDto;

  @IsDateString()
  payment_deadline: string;
}

