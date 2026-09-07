import { Router } from 'express';
import * as filesController from './files.controller.js';
import { auth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { createRateLimiter } from '../../middleware/rateLimiter.js';

export const uploadAccountRateLimiter = createRateLimiter({
  scope: 'UPLOAD_ACCOUNT',
  maxRequests: 30,
  windowSeconds: 15 * 60,
  keyGenerator: (req) => req.user?.id || '',
});

/**
 * Files routers:
 * - fileRouter:       GET /files/:fileId/content            (requires auth + file authorization)
 * - myFileRouter:     PUT/DELETE /users/me/files/:category  (requires auth)
 * - accountFileRouter:PUT/DELETE /accounts/:accountId/files/:category (requires ADMIN)
 */

// Mounted at /api/v1/files
export const fileRouter = Router();
fileRouter.get('/:fileId/content', auth, filesController.getContent);

// Mounted at /api/v1/users/me/files
export const myFileRouter = Router();
myFileRouter.put('/:category', auth, uploadAccountRateLimiter, ...filesController.putMyFile);
myFileRouter.delete('/:category', auth, filesController.deleteMyFile);

// Mounted at /api/v1/accounts/:accountId/files  (mergeParams to read parent :accountId)
export const accountFileRouter = Router({ mergeParams: true });
accountFileRouter.put('/:category', auth, requireRole('ADMIN'), uploadAccountRateLimiter, ...filesController.putAccountFile);
accountFileRouter.delete('/:category', auth, requireRole('ADMIN'), filesController.deleteAccountFile);
