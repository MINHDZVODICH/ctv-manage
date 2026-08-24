import type { RequestHandler } from 'express';
import { config } from '../config.js';
import { ApiError } from '../shared/api-error.js';
import { constantTimeEqual, deriveCsrfToken } from '../shared/security.js';
import type { AuthLocals } from './auth.middleware.js';

export function csrfMiddleware(optionalSession = false): RequestHandler {
  return (request, response, next) => {
    const auth = (response.locals as AuthLocals).auth;
    if (!auth) {
      if (optionalSession) return next();
      return next(new ApiError(401, 'AUTHENTICATION_REQUIRED', 'A valid session is required.'));
    }

    const supplied = request.headers['x-csrf-token'];
    const expected = deriveCsrfToken(auth.tokenHash, config.CSRF_SECRET);
    if (typeof supplied !== 'string' || !constantTimeEqual(supplied, expected)) {
      return next(new ApiError(403, 'CSRF_INVALID', 'The CSRF token is missing or invalid.'));
    }
    next();
  };
}

export const requireCsrf = csrfMiddleware();
