import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { config } from '../../config.js';
import type { AuthLocals } from '../../middleware/auth.middleware.js';
import { ApiError } from '../../shared/api-error.js';
import { deriveCsrfToken } from '../../shared/security.js';
import { clearSessionCookie, setSessionCookie } from '../../shared/session.js';
import { loginSchema } from './auth.schemas.js';
import { authService, type AuthService } from './auth.service.js';

export class AuthController {
  constructor(private readonly service: AuthService = authService) {}

  createSession = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      if (!request.is('application/json')) {
        throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json.');
      }
      const credentials = loginSchema.parse(request.body);
      const created = await this.service.createSession(credentials, {
        ipAddress: request.ip,
        userAgent: request.get('user-agent'),
      });
      setSessionCookie(response, created.token);
      response.status(201).json({ data: created.dto });
    } catch (error) {
      next(normalizeValidationError(error));
    }
  };

  currentSession = (_request: Request, response: Response): void => {
    const auth = (response.locals as AuthLocals).auth;
    response.status(200).json({ data: auth!.dto });
  };

  csrfToken = (_request: Request, response: Response): void => {
    const auth = (response.locals as AuthLocals).auth;
    response.status(200).json({
      data: { csrfToken: deriveCsrfToken(auth!.tokenHash, config.CSRF_SECRET) },
    });
  };

  deleteCurrentSession = async (_request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.revokeSession((response.locals as AuthLocals).sessionToken);
      clearSessionCookie(response);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  };
}

function normalizeValidationError(error: unknown): unknown {
  if (!(error instanceof ZodError)) return error;
  return new ApiError(422, 'VALIDATION_FAILED', 'Request validation failed.', error.flatten());
}
