import { z } from 'zod';
import { User } from '@prisma/client';

export const LoginRequestSchema = z.object({
  email: z.email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginRequestDto = z.infer<typeof LoginRequestSchema>;


export class LoginResponseDto {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: User;
}

