import { z } from 'zod';

const version = z.coerce.number().int().min(1);
const displayName = z.string().trim().min(2).max(120);
const phone = z.string().trim().max(30).nullable();
const dateOfBirth = z.string().date().nullable();
const gender = z.string().trim().max(30).nullable();
const address = z.string().trim().max(500).nullable();

export const accountIdParamsSchema = z.object({ accountId: z.string().trim().min(1).max(100) }).strict();
export const fileIdParamsSchema = z.object({ fileId: z.string().trim().min(1).max(100) }).strict();
export const accountFileParamsSchema = accountIdParamsSchema.extend({
  category: z.enum(['avatar', 'cccd-front', 'cccd-back', 'cv']),
});
export const selfFileParamsSchema = z.object({
  category: z.enum(['avatar', 'cccd-front', 'cccd-back', 'cv']),
}).strict();

export const accountListQuerySchema = z.object({
  q: z.string().trim().max(200).default(''),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export const accountUpdateSchema = z.object({
  version,
  displayName: displayName.optional(),
  phone: phone.optional(),
  dateOfBirth: dateOfBirth.optional(),
  gender: gender.optional(),
  address: address.optional(),
}).strict().refine((value) => Object.keys(value).some((key) => key !== 'version'), {
  message: 'At least one profile field is required.',
});

export const accountStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'DISABLED']),
  version,
}).strict();

export const accountNotesSchema = z.object({
  notes: z.string().trim().max(4000).nullable(),
  version,
}).strict();

const password = z.string().min(8).max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter.')
  .regex(/[0-9]/, 'Password must contain a number.');

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: password,
}).strict();

export const passwordResetSchema = z.object({
  newPassword: password,
  requireChangeOnLogin: z.boolean(),
}).strict();

export type AccountListQuery = z.infer<typeof accountListQuerySchema>;
export type AccountUpdateInput = z.infer<typeof accountUpdateSchema>;
export type AccountStatusInput = z.infer<typeof accountStatusSchema>;
export type AccountNotesInput = z.infer<typeof accountNotesSchema>;
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;
