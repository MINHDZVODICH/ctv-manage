import argon2 from 'argon2';
import type { Account } from '@prisma/client';
import { prisma } from '../../shared/prisma.js';
import { Errors } from '../../shared/errors.js';
import {
  generateSessionToken,
  hashToken,
  normalizeEmail,
  SESSION_TTL_MS,
} from '../../shared/crypto.js';

export interface AuthUserDto {
  id: string;
  email: string;
  displayName: string;
  phone: string | null;
  role: string;
  status: string;
  version: number;
  mustChangePassword: boolean;
  ctvCode: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
  address: string | null;
  adminNotes: string | null;
  joinedAt: Date;
  lastLoginAt: Date | null;
  createdAt: Date;
}

const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$aHQNg7tx8zc3owmVTfpcjg$FujCSTK++rj5hNlnQDdMJzUXhawmerULOGGdAfZhBuQ';

export function toUserDto(account: Account): AuthUserDto {
  return {
    id: account.id,
    email: account.email,
    displayName: account.displayName,
    phone: account.phone,
    role: account.role,
    status: account.status,
    version: account.version,
    mustChangePassword: account.mustChangePassword,
    ctvCode: account.ctvCode,
    dateOfBirth: account.dateOfBirth,
    gender: account.gender,
    address: account.address,
    adminNotes: account.adminNotes,
    joinedAt: account.joinedAt,
    lastLoginAt: account.lastLoginAt,
    createdAt: account.createdAt,
  };
}

export async function getAccountProfile(accountId: string): Promise<AuthUserDto> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
  });

  if (!account || account.deletedAt) {
    throw Errors.unauthorized();
  }

  return toUserDto(account);
}

export async function authenticate(
  emailRaw: string,
  password: string,
  ipAddress?: string,
  userAgent?: string,
) {
  const email = normalizeEmail(emailRaw);

  const account = await prisma.account.findFirst({
    where: { email, deletedAt: null },
  });

  if (!account) {
    await argon2.verify(DUMMY_HASH, password);
    throw Errors.invalidCredentials();
  }

  const valid = await argon2.verify(account.passwordHash, password);
  if (!valid) {
    throw Errors.invalidCredentials();
  }

  if (account.status !== 'ACTIVE') {
    throw Errors.accountDisabled();
  }

  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      accountId: account.id,
      tokenHash,
      expiresAt,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    },
  });

  await prisma.account.update({
    where: { id: account.id },
    data: { lastLoginAt: new Date() },
  });

  // Return fresh account (with updated lastLoginAt)
  const freshAccount = await prisma.account.findUnique({
    where: { id: account.id },
  });

  return {
    account: freshAccount ?? account,
    token,
    expiresAt,
  };
}

export async function revokeCurrentSession(tokenRaw?: string | null) {
  if (!tokenRaw) return;
  const tokenHash = hashToken(tokenRaw);
  await prisma.session.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
