import { Router } from 'express';
import * as authController from './auth.controller.js';
import { auth } from '../../middleware/auth.js';

const router = Router();

// POST /  -> login  (mounted at /api/v1/auth/sessions)
router.post('/', authController.login);

// DELETE /current -> logout
router.delete('/current', authController.logout);

// GET /me -> current user (mounted at /api/v1/users/me or /api/v1/auth/sessions/me)
// When mounted under /api/v1/auth/sessions this serves /api/v1/auth/sessions/me
// When mounted under /api/v1/users this serves /api/v1/users/me
router.get('/me', auth, authController.getMe);

export default router;
