import { IsEmail, IsString, IsNotEmpty } from 'class-validator';

export class VerifyEmailRequestDto {
  @IsString()
  @IsNotEmpty({ message: 'Token is required' })
  token: string;

  @IsEmail({}, { message: 'Invalid email format' })
  email: string;
}

