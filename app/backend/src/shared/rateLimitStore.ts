import type { RateLimitScope } from '@prisma/client';
import crypto from 'node:crypto';
import { prisma } from './prisma.js';
import { config } from '../config.js';

export type { RateLimitScope };

export interface RateLimitRecord {
  requestCount: number;
  expiresAt: Date;
}

export function calculateIdentityDigest(
  identity: string,
  secret: string = config.RATE_LIMIT_KEY_SECRET,
): string {
  return crypto.createHmac('sha256', secret).update(identity).digest('hex');
}

export async function incrementRateLimit(
  scope: RateLimitScope,
  identity: string,
  windowSeconds: number,
  now: Date = new Date(),
  secret: string = config.RATE_LIMIT_KEY_SECRET,
): Promise<RateLimitRecord> {
  const windowMs = windowSeconds * 1000;
  const currentTimestamp = now.getTime();
  const windowStart = new Date(Math.floor(currentTimestamp / windowMs) * windowMs);
  const expiresAt = new Date(windowStart.getTime() + windowMs);
  const identityDigest = calculateIdentityDigest(identity, secret);
  const id = crypto.randomUUID();

  const rows = await prisma.$queryRaw<Array<{ requestCount: number; expiresAt: Date | string }>>`
    INSERT INTO "RateLimitWindow" ("id", "scope", "identityDigest", "windowStart", "requestCount", "expiresAt")
    VALUES (${id}, ${scope}::"RateLimitScope", ${identityDigest}, ${windowStart}, 1, ${expiresAt})
    ON CONFLICT ("scope", "identityDigest", "windowStart")
    DO UPDATE SET "requestCount" = "RateLimitWindow"."requestCount" + 1
    RETURNING "requestCount", "expiresAt";
  `;

  if (!rows || rows.length === 0) {
    throw new Error('Rate limit insert/update returned no rows');
  }

  return {
    requestCount: Number(rows[0].requestCount),
    expiresAt,
  };
}

export async function cleanupExpiredRateLimits(now: Date = new Date()): Promise<number> {
  const result = await prisma.rateLimitWindow.deleteMany({
    where: {
      expiresAt: {
        lt: now,
      },
    },
  });
  return result.count;
}
