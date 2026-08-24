import { RegistrationRequestStatus } from '@prisma/client';
import { z } from 'zod';

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined);
const dateOfBirthSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Invalid date of birth.')
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

export const registrationProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(320).transform((email) => email.toLowerCase()),
  phone: z.string().trim().min(1).max(30),
  dateOfBirth: dateOfBirthSchema.optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  address: optionalText(500),
  password: z.string().min(8).max(128).regex(/[A-Za-z]/).regex(/[0-9]/),
}).strict();

export const registrationListQuerySchema = z.object({
  status: z.nativeEnum(RegistrationRequestStatus).default(RegistrationRequestStatus.PENDING),
  q: z.string().trim().max(120).optional().default(''),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export const registrationRequestParamsSchema = z.object({
  requestId: z.string().trim().min(1).max(128),
}).strict();

export const registrationDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  expectedStatus: z.literal('PENDING'),
  rejectionReason: optionalText(500),
}).strict();

export type RegistrationProfileInput = z.infer<typeof registrationProfileSchema>;
export type RegistrationListQuery = z.infer<typeof registrationListQuerySchema>;
export type RegistrationDecisionInput = z.infer<typeof registrationDecisionSchema>;
