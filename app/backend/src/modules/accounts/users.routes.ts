import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import { upload } from '../../shared/file-storage.js';
import * as accountController from './accounts.controller.js';
import * as scheduleController from '../schedules/schedule.controller.js';

const router = Router();

// /api/v1/users
router.get('/me', authenticate, accountController.getMyProfile);
router.put('/me', authenticate, accountController.updateMyProfile);
router.put('/me/password', authenticate, accountController.changeMyPassword);

// Schedule endpoints for current user
router.get('/me/schedule-registration', authenticate, scheduleController.getMyRegistration);
router.put('/me/schedule-registration', authenticate, scheduleController.saveMyRegistration);
router.get('/me/shifts', authenticate, scheduleController.getMyShifts);

// File upload endpoints for current user
router.post('/me/avatar', authenticate, upload.single('file'), accountController.updateMyAvatar);
router.post('/me/cccd-front', authenticate, upload.single('file'), accountController.updateMyCccdFront);
router.post('/me/cccd-back', authenticate, upload.single('file'), accountController.updateMyCccdBack);
router.post('/me/cv', authenticate, upload.single('file'), accountController.updateMyCv);

export default router;
