import { z } from 'zod';

export const ResendVerificationEmailRequestSchema = z.object({
  email: z.email('Invalid email format'),
});

export type ResendVerificationEmailRequestDto = z.infer<typeof ResendVerificationEmailRequestSchema>;

