import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    HOST: z.string().default('0.0.0.0'),
    DATABASE_URL: z.string().min(1).optional(),
    CORS_ORIGIN: z.string().default('http://localhost:3000,http://localhost:3001'),
    FILE_STORAGE_ROOT: z.string().default('uploads'),
    STORAGE_DRIVER: z.enum(['local', 'supabase']).default('local'),
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    SUPABASE_STORAGE_BUCKET: z.string().min(1).default('ctv-files'),
  })
  .superRefine((data, ctx) => {
    if (data.STORAGE_DRIVER === 'supabase') {
      if (!data.SUPABASE_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SUPABASE_URL'],
          message: 'SUPABASE_URL is required when STORAGE_DRIVER is supabase',
        });
      }
      if (!data.SUPABASE_SERVICE_ROLE_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SUPABASE_SERVICE_ROLE_KEY'],
          message: 'SUPABASE_SERVICE_ROLE_KEY is required when STORAGE_DRIVER is supabase',
        });
      }
      if (!data.SUPABASE_STORAGE_BUCKET || data.SUPABASE_STORAGE_BUCKET.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SUPABASE_STORAGE_BUCKET'],
          message: 'SUPABASE_STORAGE_BUCKET is required when STORAGE_DRIVER is supabase',
        });
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  throw new Error('Environment configuration validation failed');
}

export const config = parsed.data;
export type Config = z.infer<typeof envSchema>;
export default config;
