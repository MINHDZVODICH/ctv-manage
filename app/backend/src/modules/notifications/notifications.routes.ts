import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import * as controller from './notifications.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', controller.getNotifications);
router.patch('/read-all', controller.markAllRead);
router.delete('/', controller.clearNotifications);

export default router;
