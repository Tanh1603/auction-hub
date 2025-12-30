import { IsEmail, IsString, MinLength, IsOptional, IsEnum, Matches } from 'class-validator';

enum UserType {
  INDIVIDUAL = 'individual',
  BUSINESS = 'business',
}

export class RegisterRequestDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password: string;

  @IsOptional()
  @IsString()
  @Matches(/^(0)\d{9}$/, {
    message: 'Phone number must be a valid Vietnamese phone number',
  })
  phone_number?: string;

  @IsOptional()
  @IsString()
  full_name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(001|002|004|006|008|010|011|012|014|015|017|019|020|022|024|025|026|027|030|031|033|034|035|036|037|038|040|042|044|045|046|048|049|051|052|054|056|058|060|062|064|066|067|068|070|072|074|075|077|079|080|082|083|084|086|087|089|091|092|093|094|095|096)[0-3]\d{2}\d{6}$/,
  {
    message: 'Identity number must be a valid Vietnamese Citizen Identity Card',
  })
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

