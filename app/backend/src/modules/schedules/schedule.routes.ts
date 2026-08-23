import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import * as controller from './schedule.controller.js';

const router = Router();

// Lịch tổng hợp (Admin)
router.get('/schedule-summary', authenticate, requireRole('Admin'), controller.getScheduleSummary);

// Chi tiết ca làm việc
router.get('/shifts/:id', authenticate, controller.getShiftDetail);

// Hủy đăng ký ca (Single or Series)
router.delete('/shift-registrations/:id', authenticate, controller.cancelMyShift);

export default router;
