import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ContractStatus } from '../../../generated';

export class UpdateContractDto {
  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;

  @IsOptional()
  @IsString()
  docUrl?: string;
}

