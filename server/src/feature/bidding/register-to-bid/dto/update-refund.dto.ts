import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum RefundAction {
  APPROVE = 'approve',
  REJECT = 'reject',
  PROCESS = 'process',
}

export class UpdateRefundDto {
  @ApiProperty({
    description: 'Action to perform on the refund',
    enum: RefundAction,
    example: RefundAction.APPROVE,
  })
  @IsEnum(RefundAction)
  action: RefundAction;

  @ApiPropertyOptional({
    description: 'Reason for rejecting the refund (required for reject action)',
    example: 'Deposit forfeited due to rule violation',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
