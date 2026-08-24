import { Router } from 'express';
import { sessionMiddleware } from '../../middleware/auth.middleware.js';
import { csrfMiddleware } from '../../middleware/csrf.middleware.js';
import { createRateLimitMiddleware } from '../../middleware/rate-limit.middleware.js';
import { AuthController } from './auth.controller.js';
import { authService } from './auth.service.js';

export function createAuthRouter(): Router {
  const router = Router();
  const controller = new AuthController(authService);
  const loginRateLimit = createRateLimitMiddleware({
    max: 5,
    windowMs: 15 * 60 * 1000,
    key: (request) => `${request.ip ?? 'unknown'}:${String(request.body?.email ?? '').trim().toLowerCase()}`,
  });

  router.post('/sessions', loginRateLimit, controller.createSession);
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
