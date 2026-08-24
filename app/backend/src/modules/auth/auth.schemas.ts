import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(128),
}).strict();

export type LoginInput = z.infer<typeof loginSchema>;
