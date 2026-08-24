import { z } from 'zod';

const environmentSchema = z.object({
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
  CSRF_SECRET: z.string().min(32).default('development-only-csrf-secret-change-me'),
  DATABASE_URL: z.string().default(process.env.NODE_ENV === 'test' ? 'file:./test.db' : 'file:./dev.db'),
  FILE_STORAGE_ROOT: z.string().default('./private-storage'),
  FILE_IMAGE_MAX_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  FILE_CV_MAX_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
});

const parsed = environmentSchema.parse(process.env);

export const config = {
  ...parsed,
  allowedOrigins: parsed.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
};
