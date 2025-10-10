import { IsEmail, IsString, IsNotEmpty } from 'class-validator';
import { User } from '@prisma/client';

export class LoginRequestDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}


export class LoginResponseDto {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: User;
}

