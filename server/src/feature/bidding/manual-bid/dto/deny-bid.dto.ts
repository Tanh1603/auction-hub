import { IsUUID, IsString, IsOptional, MaxLength } from 'class-validator';

export class DenyBidDto {
  @IsUUID('4')
  bidId: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  reason?: string;
}
