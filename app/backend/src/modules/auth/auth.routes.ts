import { Router } from 'express';
import { createHash } from 'node:crypto';
import { sessionMiddleware } from '../../middleware/auth.middleware.js';
import { csrfMiddleware } from '../../middleware/csrf.middleware.js';
import { createRateLimitMiddleware } from '../../middleware/rate-limit.middleware.js';
import { requireAllowedOrigin } from '../../middleware/origin.middleware.js';
import { AuthController } from './auth.controller.js';
import { authService } from './auth.service.js';

export function createAuthRouter(): Router {
  const router = Router();
  const controller = new AuthController(authService);
  const loginRateLimit = createRateLimitMiddleware({
    max: 5,
    maxKeys: 10_000,
    windowMs: 15 * 60 * 1000,
    key: (request) => {
      const ipAddress = (request.ip ?? 'unknown').slice(0, 64);
      const normalizedEmail = String(request.body?.email ?? '').trim().toLowerCase().slice(0, 320);
      const emailHash = createHash('sha256').update(normalizedEmail).digest('hex');
      return `${ipAddress}:${emailHash}`;
    },
  });

  router.post('/sessions', requireAllowedOrigin, loginRateLimit, controller.createSession);
  router.get('/sessions/current', sessionMiddleware(authService), controller.currentSession);
  router.get('/csrf-token', sessionMiddleware(authService), controller.csrfToken);
  router.delete(
    '/sessions/current',
    sessionMiddleware(authService, true),
    csrfMiddleware(true),
    controller.deleteCurrentSession,
  );

  return router;
}
