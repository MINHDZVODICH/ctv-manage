import { z } from 'zod';

export const notificationIdParamsSchema = z.object({ notificationId: z.string().trim().min(1).max(100) }).strict();
export const notificationListQuerySchema = z.object({
  read: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
export const notificationReadSchema = z.object({ read: z.boolean() }).strict();

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
