import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ').trim().toLowerCase(),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email không hợp lệ').trim().toLowerCase(),
});

export const verifyOtpSchema = z.object({
  email: z.string().email('Email không hợp lệ').trim().toLowerCase(),
  otp: z.string().length(6, 'Mã OTP gồm 6 chữ số'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
  newPassword: z.string().min(6, 'Mật khẩu mới phải có ít nhất 6 ký tự'),
});
