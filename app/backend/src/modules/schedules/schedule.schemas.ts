import { z } from 'zod';

const ymd = z.string().date();
const period = z.enum(['MORNING', 'AFTERNOON']);
const weekday = z.number().int().min(1).max(5);
const MAX_REGISTRATION_DAYS = 180;

export const scheduleRegistrationSchema = z.object({
  startDate: ymd,
  endDate: ymd,
  timeZone: z.literal('Asia/Bangkok'),
  roomCode: z.enum(['ROOM_1', 'ROOM_2', 'ROOM_3', 'ROOM_4']),
  workContent: z.string().trim().min(1).max(2000),
  slots: z.array(z.object({ weekday, period }).strict()).min(1).max(10),
  version: z.number().int().min(1).nullable(),
}).strict()
  .refine((value) => value.endDate >= value.startDate, {
    message: 'endDate must be on or after startDate.', path: ['endDate'],
  })
  .refine((value) => daysBetween(value.startDate, value.endDate) <= MAX_REGISTRATION_DAYS, {
    message: `Schedule registrations cannot span more than ${MAX_REGISTRATION_DAYS} days.`, path: ['endDate'],
  })
  .refine((value) => new Set(value.slots.map((slot) => `${slot.weekday}:${slot.period}`)).size === value.slots.length, {
    message: 'Schedule slots must be unique.', path: ['slots'],
  });

export const shiftIdParamsSchema = z.object({ shiftId: z.string().trim().min(1).max(100) }).strict();
export const assignmentIdParamsSchema = z.object({ assignmentId: z.string().trim().min(1).max(100) }).strict();
export const registrationIdParamsSchema = z.object({ registrationId: z.string().trim().min(1).max(100) }).strict();

export const myShiftsQuerySchema = z.object({
  from: ymd.optional(),
  to: ymd.optional(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
}).strict().superRefine((value, context) => {
  const hasRange = value.from !== undefined || value.to !== undefined;
  if (value.month && hasRange) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Use either month or from/to, not both.' });
  } else if (!value.month && (!value.from || !value.to)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'month or both from and to are required.' });
  } else if (value.from && value.to && value.to < value.from) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'to must be on or after from.', path: ['to'] });
  }
});

export const cancelSeriesQuerySchema = z.object({
  weekday: z.coerce.number().int().min(1).max(5),
  period,
  fromDate: ymd,
}).strict();

export type ScheduleRegistrationInput = z.infer<typeof scheduleRegistrationSchema>;
export type MyShiftsQuery = z.infer<typeof myShiftsQuerySchema>;
export type CancelSeriesQuery = z.infer<typeof cancelSeriesQuerySchema>;

function daysBetween(startDate: string, endDate: string): number {
  return (Date.parse(`${endDate}T00:00:00.000Z`) - Date.parse(`${startDate}T00:00:00.000Z`)) / 86_400_000;
}
