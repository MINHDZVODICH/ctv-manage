export type UserRole = 'ADMIN' | 'CTV';
export type AccountStatus = 'ACTIVE' | 'DISABLED';

export interface AuthUser {
  id: string;
  displayName: string;
  role: UserRole;
  status: AccountStatus;
  mustChangePassword: boolean;
}

export interface SessionData {
  user: AuthUser;
  expiresAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface CsrfTokenData {
  csrfToken: string;
}

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  requestId?: string;
  details?: unknown;
}

export interface ApiErrorEnvelope {
  error: ApiErrorBody;
}
