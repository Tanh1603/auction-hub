import { IsEmail } from 'class-validator';

export class ResendVerificationEmailRequestDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;
}

