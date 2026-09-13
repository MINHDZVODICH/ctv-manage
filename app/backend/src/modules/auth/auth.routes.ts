import express, { Router } from 'express';
import * as authController from './auth.controller.js';
import { auth } from '../../middleware/auth.js';
import { createRateLimiter } from '../../middleware/rateLimiter.js';
import { normalizeEmail } from '../../shared/crypto.js';
import { config } from '../../config.js';

const router = Router();

const isE2E = config.E2E_TEST;

export const loginIpRateLimiter = createRateLimiter({
  scope: 'LOGIN_IP',
  maxRequests: isE2E ? 1000 : 60,
  windowSeconds: 15 * 60,
  keyGenerator: (req) => req.ip || '127.0.0.1',
});

export const loginAccountRateLimiter = createRateLimiter({
  scope: 'LOGIN_ACCOUNT',
  maxRequests: isE2E ? 1000 : 10,
  windowSeconds: 15 * 60,
  keyGenerator: (req) => {
    const ip = req.ip || '127.0.0.1';
    const email = typeof req.body?.email === 'string' ? normalizeEmail(req.body.email) : '';
    return `${ip}:${email}`;
  },
});

// POST /  -> login  (mounted at /api/v1/auth/sessions)
router.post('/', loginIpRateLimiter, express.json(), loginAccountRateLimiter, authController.login);

// DELETE /current or /me -> logout
router.delete('/current', authController.logout);
router.delete('/me', authController.logout);

// GET /me -> current user (mounted at /api/v1/users/me or /api/v1/auth/sessions/me)
// When mounted under /api/v1/auth/sessions this serves /api/v1/auth/sessions/me
// When mounted under /api/v1/users this serves /api/v1/users/me
router.get('/me', auth, authController.getMe);

export default router;
