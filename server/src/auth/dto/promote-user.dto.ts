import { IsString, IsEnum, IsOptional } from 'class-validator';
import { UserRole } from '../../../generated';

export class PromoteUserDto {
  @IsEnum(UserRole, {
    message: 'Role must be one of: bidder, auctioneer, admin, super_admin',
  })
  role: UserRole;

  @IsOptional()
  @IsString()
  reason?: string;
}
