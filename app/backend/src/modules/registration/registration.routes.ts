import { Router } from 'express';
import * as registrationController from './registration.controller.js';
import { auth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';

const router = Router();

// POST / — public (no auth), multipart via controller's multer chain
router.post('/', registrationController.create as any);

// GET / — list pending (ADMIN)  ?status=PENDING&q=&page=&pageSize=
router.get('/', auth, requireRole('ADMIN'), registrationController.list);

// PATCH /:requestId — decide (ADMIN)  body { decision, expectedStatus, rejectionReason? }
router.patch('/:requestId', auth, requireRole('ADMIN'), registrationController.decide);

export default router;
