import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import * as controller from './auth.controller.js';

const router = Router();

router.post('/sessions', controller.login);
router.delete('/sessions/current', controller.logout);
router.get('/sessions/current', authenticate, controller.getCurrentSession);
router.post('/forgot-password', controller.forgotPassword);
router.post('/verify-otp', controller.verifyOtp);

export default router;
