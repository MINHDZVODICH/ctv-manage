import argon2 from 'argon2';
import { AccountStatus, type Account, type PrismaClient, type Session } from '@prisma/client';
import { ApiError } from '../../shared/api-error.js';
import { prisma } from '../../shared/prisma.js';
import { generateSessionToken, hashSessionToken } from '../../shared/security.js';
import { SESSION_TTL_MS } from '../../shared/session.js';
import { toSessionDto, type SessionDto } from './auth.dto.js';
import type { LoginInput } from './auth.schemas.js';

const DUMMY_PASSWORD_HASH = '$argon2id$v=19$m=65536,p=4,t=3$2/wrdwse+zvaP/N2mpSvJA$B3toiYHwIrTE8PrXY4QIj2VwizgdI54Z6esn1LH/Cik';

export interface SessionMetadata {
  ipAddress?: string;
  userAgent?: string;
}

export interface CreatedSession {
  token: string;
  dto: SessionDto;
}

export interface ResolvedSession {
  session: Session;
  account: Account;
  tokenHash: string;
  dto: SessionDto;
}

export class AuthService {
  constructor(
    private readonly database: PrismaClient = prisma,
    private readonly now: () => Date = () => new Date(),
  ) {}

  hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  verifyPassword(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }

  async createSession(credentials: LoginInput, metadata: SessionMetadata = {}): Promise<CreatedSession> {
    const email = credentials.email.trim().toLowerCase();
    const account = await this.database.account.findUnique({ where: { email } });
    const passwordMatches = await this.verifyPassword(account?.passwordHash ?? DUMMY_PASSWORD_HASH, credentials.password);

    if (!account || account.deletedAt || !passwordMatches) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }
    if (account.status === AccountStatus.DISABLED) {
      throw new ApiError(403, 'ACCOUNT_DISABLED', 'This account is disabled.');
    }

    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const now = this.now();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    const session = await this.database.$transaction(async (transaction) => {
      const created = await transaction.session.create({
        data: {
          accountId: account.id,
          tokenHash,
          expiresAt,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      });
      await transaction.account.update({ where: { id: account.id }, data: { lastLoginAt: now } });
      return created;
    });

    return { token, dto: toSessionDto(session, account) };
  }

  async resolveSession(token: string): Promise<ResolvedSession> {
    const tokenHash = hashSessionToken(token);
    const result = await this.database.session.findUnique({
      where: { tokenHash },
      include: { account: true },
    });
    const now = this.now();
    if (
      !result
      || result.revokedAt
      || result.expiresAt.getTime() <= now.getTime()
      || result.account.deletedAt
      || result.account.status !== AccountStatus.ACTIVE
    ) {
      throw new ApiError(401, 'AUTHENTICATION_REQUIRED', 'A valid session is required.');
    }

    return {
      session: result,
      account: result.account,
      tokenHash,
      dto: toSessionDto(result, result.account),
    };
  }

  async revokeSession(token: string | undefined): Promise<void> {
    if (!token) return;
    await this.database.session.updateMany({
      where: { tokenHash: hashSessionToken(token), revokedAt: null },
      data: { revokedAt: this.now() },
    });
  }
}

export const authService = new AuthService();
