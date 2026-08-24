import type { RequestHandler } from 'express';
import { authService, type AuthService, type ResolvedSession } from '../modules/auth/auth.service.js';
import { ApiError } from '../shared/api-error.js';
import { readSessionToken } from '../shared/session.js';

export interface AuthLocals {
  auth?: ResolvedSession;
  sessionToken?: string;
}

export function sessionMiddleware(service: AuthService = authService, optional = false): RequestHandler {
  return async (request, response, next) => {
    const token = readSessionToken(request);
    (response.locals as AuthLocals).sessionToken = token;
    if (!token) {
      if (optional) return next();
      return next(new ApiError(401, 'AUTHENTICATION_REQUIRED', 'A valid session is required.'));
    }

    try {
      (response.locals as AuthLocals).auth = await service.resolveSession(token);
      next();
    } catch (error) {
      if (optional && error instanceof ApiError && error.statusCode === 401) return next();
      next(error);
    }
  };
}

export const requireSession = sessionMiddleware();

export function requireRole(...roles: Array<'ADMIN' | 'CTV'>): RequestHandler {
  return (_request, response, next) => {
    const auth = (response.locals as AuthLocals).auth;
    if (!auth) return next(new ApiError(401, 'AUTHENTICATION_REQUIRED', 'A valid session is required.'));
    if (!roles.includes(auth.account.role)) {
      return next(new ApiError(403, 'FORBIDDEN', 'You do not have permission to perform this action.'));
    }
    next();
  };
}
