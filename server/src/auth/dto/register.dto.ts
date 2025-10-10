import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';

enum UserType {
  INDIVIDUAL = 'individual',
  BUSINESS = 'business',
}

export class RegisterRequestDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;

  @IsOptional()
  @IsString()
  phone_number?: string;

  @IsOptional()
  @IsString()
  full_name?: string;

  @IsOptional()
  @IsString()
  identity_number?: string;

  @IsOptional()
  @IsEnum(UserType, { message: 'User type must be either individual or business' })
  user_type?: UserType;

  @IsOptional()
  @IsString()
  tax_id?: string | null;
}

export class RegisterResponseDto {
  user_id: string;
  email: string;
  verification_required: boolean;
}

