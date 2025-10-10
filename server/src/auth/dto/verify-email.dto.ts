import { z } from 'zod';

export const VerifyEmailRequestSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  email: z.email('Invalid email format'),
});

export type VerifyEmailRequestDto = z.infer<typeof VerifyEmailRequestSchema>;

