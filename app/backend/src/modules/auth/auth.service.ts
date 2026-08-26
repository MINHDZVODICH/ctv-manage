import argon2 from 'argon2';
import { prisma } from '../../shared/prisma.js';
import { Errors } from '../../shared/errors.js';
import {
  generateSessionToken,
  hashToken,
  normalizeEmail,
  SESSION_TTL_MS,
} from '../../shared/crypto.js';

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
    throw Errors.invalidCredentials();
  }

  if (account.status !== 'ACTIVE') {
    throw Errors.accountDisabled();
  }

  const valid = await argon2.verify(account.passwordHash, password);
  if (!valid) {
    throw Errors.invalidCredentials();
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
