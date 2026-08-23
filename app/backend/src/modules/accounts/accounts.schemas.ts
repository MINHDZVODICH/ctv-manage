import { z } from 'zod';

export const createAccountSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập họ và tên').trim(),
  email: z.string().email('Email không hợp lệ').trim().toLowerCase(),
  phone: z.string().min(8, 'Số điện thoại không hợp lệ').trim(),
  role: z.enum(['Admin', 'Cộng tác viên']).default('Cộng tác viên'),
  address: z.string().optional(),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự').optional(),
});

export const toggleStatusSchema = z.object({
  status: z.enum(['Kích hoạt', 'Vô hiệu hóa']).optional(),
});

export const changeRoleSchema = z.object({
  role: z.enum(['Admin', 'Cộng tác viên']),
});

export const adminResetPasswordSchema = z.object({
  newPassword: z.string().min(6, 'Mật khẩu mới phải có ít nhất 6 ký tự'),
  mustChangePassword: z.boolean().default(false),
});

export const saveNotesSchema = z.object({
  notes: z.string(),
});

export const endScheduleSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(8).optional(),
  dob: z.string().optional(),
  gender: z.string().optional(),
  cccd: z.string().optional(),
  address: z.string().optional(),
  skills: z.array(z.string()).optional(),
  notes: z.string().optional(),
  cccdFrontBase64: z.string().optional(),
  cccdBackBase64: z.string().optional(),
  cvFileBase64: z.string().optional(),
  cvFileName: z.string().optional(),
  avatarBase64: z.string().optional(),
});
