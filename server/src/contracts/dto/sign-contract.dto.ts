import { IsOptional, IsString } from 'class-validator';

export class SignContractDto {
  @IsOptional()
  @IsString()
  docUrl?: string;
}

