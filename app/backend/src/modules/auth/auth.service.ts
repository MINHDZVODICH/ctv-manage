import { prisma } from '../../shared/prisma.js';
import { generateSessionToken, hashToken, verifyPassword, hashPassword } from '../../shared/session.js';
import { ApiError } from '../../shared/api-error.js';
import { formatAccountDto } from '../accounts/account.dto.js';
import { logAudit } from '../audit/audit.service.js';

// In-memory OTP storage for forgot-password flow (mock email delivery)
const otpStore = new Map<string, { otp: string; expiresAt: number }>();

export const login = async (
  email: string,
  pass: string,
  ipAddress?: string,
  userAgent?: string,
  requestId?: string,
) => {
  const account = await prisma.account.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: {
      skills: { include: { skill: true } },
      files: { include: { file: true } },
      _count: { select: { shiftAssignments: true } },
    },
  });

  if (!account || account.deletedAt) {
    throw ApiError.unauthorized('Email hoặc mật khẩu không chính xác');
  }

  if (account.status === 'Vô hiệu hóa') {
    throw ApiError.forbidden('Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.');
  }

  const isValidPassword = await verifyPassword(pass, account.passwordHash);
  if (!isValidPassword) {
    throw ApiError.unauthorized('Email hoặc mật khẩu không chính xác');
  }

  const rawToken = generateSessionToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await prisma.session.create({
    data: {
      accountId: account.id,
      tokenHash,
      expiresAt,
      ipAddress,
      userAgent,
    },
  });

  await prisma.account.update({
    where: { id: account.id },
    data: { lastLoginAt: new Date() },
  });

  await logAudit({
    actorAccountId: account.id,
    action: 'LOGIN',
    targetType: 'ACCOUNT',
    targetId: account.id,
    requestId,
    metadata: { email: account.email, role: account.role },
  });

  return {
    token: rawToken,
    user: formatAccountDto(account),
  };
};

export const logout = async (token: string, requestId?: string) => {
  const tokenHash = hashToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
  });

  if (session) {
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    await logAudit({
      actorAccountId: session.accountId,
      action: 'LOGOUT',
      targetType: 'SESSION',
      targetId: session.id,
      requestId,
    });
  }
};

export const getCurrentUser = async (accountId: string) => {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: {
      skills: { include: { skill: true } },
      files: { include: { file: true } },
      _count: { select: { shiftAssignments: true } },
    },
  });

  if (!account || account.deletedAt) {
    throw ApiError.unauthorized('Tài khoản không tồn tại hoặc đã bị xóa');
  }

  return formatAccountDto(account);
};

export const sendForgotPasswordOtp = async (email: string) => {
  const account = await prisma.account.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!account || account.deletedAt) {
    throw ApiError.notFound('Email không tồn tại trong hệ thống');
  }

  // Generate 6 digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(email.toLowerCase().trim(), {
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
  });

  return {
    success: true,
    message: 'Mã OTP đã được gửi đến email của bạn',
    // We also return the OTP in development mode for easy testing
    otp: process.env.NODE_ENV !== 'production' ? otp : undefined,
  };
};

export const verifyForgotPasswordOtp = async (email: string, otp: string) => {
  const record = otpStore.get(email.toLowerCase().trim());
  if (!record) {
    throw ApiError.badRequest('Yêu cầu mã OTP không tồn tại hoặc đã hết hạn');
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(email.toLowerCase().trim());
    throw ApiError.badRequest('Mã OTP đã hết hạn');
  }

  if (record.otp !== otp) {
    throw ApiError.badRequest('Mã OTP không chính xác');
  }

  otpStore.delete(email.toLowerCase().trim());

  // Log in user directly after OTP verification or return temporary access
  const account = await prisma.account.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: {
      skills: { include: { skill: true } },
      files: { include: { file: true } },
      _count: { select: { shiftAssignments: true } },
    },
  });

  if (!account) {
    throw ApiError.notFound('Tài khoản không tồn tại');
  }

  const rawToken = generateSessionToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      accountId: account.id,
      tokenHash,
      expiresAt,
    },
  });

  return {
    token: rawToken,
    user: formatAccountDto(account),
  };
};

export const changeSelfPassword = async (
  accountId: string,
  currentPass: string,
  newPass: string,
  requestId?: string,
) => {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    throw ApiError.notFound('Tài khoản không tồn tại');
  }

  const isMatch = await verifyPassword(currentPass, account.passwordHash);
  if (!isMatch) {
    throw ApiError.badRequest('Mật khẩu hiện tại không chính xác');
  }

  const newHash = await hashPassword(newPass);

  await prisma.$transaction(async (tx) => {
    await tx.account.update({
      where: { id: accountId },
      data: {
        passwordHash: newHash,
        passwordChangedAt: new Date(),
        mustChangePassword: false,
      },
    });

    // Revoke all other sessions except current (or all sessions)
    await tx.session.updateMany({
      where: { accountId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });

  await logAudit({
    actorAccountId: accountId,
    action: 'CHANGE_PASSWORD',
    targetType: 'ACCOUNT',
    targetId: accountId,
    requestId,
  });

  return { success: true };
};
