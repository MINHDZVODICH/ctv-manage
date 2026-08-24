import type { Account, Session } from '@prisma/client';

export interface AuthUserDto {
  id: string;
  displayName: string;
  role: 'ADMIN' | 'CTV';
  status: 'ACTIVE' | 'DISABLED';
  mustChangePassword: boolean;
}

export interface SessionDto {
  user: AuthUserDto;
  expiresAt: string;
}

export function toAuthUserDto(account: Account): AuthUserDto {
  return {
    id: account.id,
    displayName: account.displayName,
    role: account.role,
    status: account.status,
    mustChangePassword: account.mustChangePassword,
  };
}

export function toSessionDto(session: Session, account: Account): SessionDto {
  return {
    user: toAuthUserDto(account),
    expiresAt: session.expiresAt.toISOString(),
  };
}
