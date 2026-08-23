import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import { upload } from '../../shared/file-storage.js';
import * as controller from './registration-requests.controller.js';

const router = Router();

// Public submission
router.post(
  '/',
  upload.fields([
    { name: 'cccdFront', maxCount: 1 },
    { name: 'cccdBack', maxCount: 1 },
    { name: 'cvFile', maxCount: 1 },
  ]),
  controller.createRequest,
);

// Admin-only endpoints
router.get('/', authenticate, requireRole('Admin'), controller.listRequests);
router.get('/:id', authenticate, requireRole('Admin'), controller.getRequestDetail);
router.patch('/:id', authenticate, requireRole('Admin'), controller.reviewRequest);

export default router;
