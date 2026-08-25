import { Router } from 'express';
import { requireRole, requireSession } from '../../middleware/auth.middleware.js';
import { requireCsrf } from '../../middleware/csrf.middleware.js';
import { requireAllowedOrigin } from '../../middleware/origin.middleware.js';
import { ScheduleController } from './schedule.controller.js';
import { ScheduleService } from './schedule.service.js';

export function createScheduleRouter(service: ScheduleService): Router {
  const router = Router();
  const controller = new ScheduleController(service);
  const ctvRead = [requireSession, requireRole('CTV')] as const;
  const ctvMutation = [requireSession, requireRole('CTV'), requireAllowedOrigin, requireCsrf] as const;

  router.get('/users/me/schedule-registration', ...ctvRead, controller.currentRegistration);
  router.put('/users/me/schedule-registration', ...ctvMutation, controller.saveRegistration);
  router.get('/users/me/shifts', ...ctvRead, controller.myShifts);
  router.get('/shifts/:shiftId', requireSession, requireRole('CTV', 'ADMIN'), controller.shiftDetail);
  router.delete('/users/me/shift-assignments/:assignmentId', ...ctvMutation, controller.cancelOne);
  router.delete('/users/me/schedule-registrations/:registrationId/assignments', ...ctvMutation, controller.cancelSeries);
  return router;
}
