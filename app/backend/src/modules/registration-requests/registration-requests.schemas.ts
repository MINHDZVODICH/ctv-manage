import { z } from 'zod';

export const createRegistrationRequestSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập họ và tên').trim(),
  email: z.string().email('Email không hợp lệ').trim().toLowerCase(),
  phone: z.string().min(8, 'Số điện thoại không hợp lệ').trim(),
  dob: z.string().optional(),
  citizenId: z.string().optional(),
  address: z.string().optional(),
  experience: z.string().optional(),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự').optional(),
});

export const reviewRequestSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  rejectionReason: z.string().optional(),
});
