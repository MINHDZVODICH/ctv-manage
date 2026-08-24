import { z } from 'zod';

const environmentSchema = z.object({
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().default(process.env.NODE_ENV === 'test' ? 'file:./test.db' : 'file:./dev.db'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
});

const parsed = environmentSchema.parse(process.env);

export const config = {
  ...parsed,
  allowedOrigins: parsed.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
};
