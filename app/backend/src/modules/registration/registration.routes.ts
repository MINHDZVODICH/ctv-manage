import { Router } from 'express';
import * as registrationController from './registration.controller.js';
import { auth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { createRateLimiter } from '../../middleware/rateLimiter.js';

const router = Router();

export const registrationIpRateLimiter = createRateLimiter({
  scope: 'REGISTRATION_IP',
  maxRequests: 5,
  windowSeconds: 60 * 60,
  keyGenerator: (req) => req.ip || '127.0.0.1',
});

// POST / — public (no auth), multipart via controller's multer chain
router.post('/', registrationIpRateLimiter, registrationController.create as any);

// GET / — list pending (ADMIN)  ?status=PENDING&q=&page=&pageSize=
router.get('/', auth, requireRole('ADMIN'), registrationController.list);

// PATCH /:requestId — decide (ADMIN)  body { decision, expectedStatus, rejectionReason? }
router.patch('/:requestId', auth, requireRole('ADMIN'), registrationController.decide);

export default router;
