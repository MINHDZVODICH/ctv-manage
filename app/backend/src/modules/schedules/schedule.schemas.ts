import { z } from 'zod';

export const schedulePatternSlotSchema = z.object({
  weekday: z.number().min(0).max(6),
  period: z.enum(['MORNING', 'AFTERNOON', 'EVENING']),
  enabled: z.boolean().default(true),
});

export const saveScheduleRegistrationSchema = z.object({
  roomCode: z.string().default('ROOM_1'),
  room: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày bắt đầu phải theo định dạng YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày kết thúc phải theo định dạng YYYY-MM-DD'),
  timeZone: z.string().default('Asia/Ho_Chi_Minh'),
  workContent: z.string().optional(),
  slots: z.array(schedulePatternSlotSchema).min(1, 'Vui lòng chọn ít nhất một ca làm việc trong tuần'),
  version: z.number().optional(),
});

export const cancelShiftSchema = z.object({
  scope: z.enum(['single', 'series']).default('single'),
  fromDate: z.string().optional(),
  reason: z.string().optional(),
});
