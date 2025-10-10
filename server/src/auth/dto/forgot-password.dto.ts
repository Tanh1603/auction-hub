import { IsEmail } from 'class-validator';

export class ForgotPasswordRequestDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;
}

