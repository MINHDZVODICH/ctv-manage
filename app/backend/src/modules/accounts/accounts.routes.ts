import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import { upload } from '../../shared/file-storage.js';
import * as controller from './accounts.controller.js';

const router = Router();

// /api/v1/accounts
router.get('/', authenticate, requireRole('Admin'), controller.listAccounts);
router.post('/', authenticate, requireRole('Admin'), controller.createAccount);
router.get('/:id', authenticate, requireRole('Admin'), controller.getAccountDetail);
router.patch('/:id/status', authenticate, requireRole('Admin'), controller.toggleStatus);
router.delete('/:id', authenticate, requireRole('Admin'), controller.deleteAccount);
router.patch('/:id/role', authenticate, requireRole('Admin'), controller.changeRole);
router.put('/:id/password', authenticate, requireRole('Admin'), controller.adminResetPassword);
router.patch('/:id/notes', authenticate, requireRole('Admin'), controller.saveNotes);
router.post('/:id/end-schedule', authenticate, requireRole('Admin'), controller.endSchedule);

export default router;
