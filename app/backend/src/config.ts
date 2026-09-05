import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1).optional(),
  CORS_ORIGIN: z.string().default('http://localhost:3000,http://localhost:3001'),
  FILE_STORAGE_ROOT: z.string().default('uploads'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  throw new Error('Environment configuration validation failed');
}

export const config = parsed.data;
export type Config = z.infer<typeof envSchema>;
export default config;
