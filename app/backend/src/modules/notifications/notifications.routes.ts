import { Router } from 'express';
import { requireSession } from '../../middleware/auth.middleware.js';
import { requireCsrf } from '../../middleware/csrf.middleware.js';
import { requireAllowedOrigin } from '../../middleware/origin.middleware.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

export function createNotificationsRouter(service: NotificationsService = new NotificationsService()): Router {
  const router = Router(); const controller = new NotificationsController(service);
  router.get('/notifications', requireSession, controller.list);
  router.patch('/notifications/:notificationId', requireSession, requireAllowedOrigin, requireCsrf, controller.updateRead);
  return router;
}
