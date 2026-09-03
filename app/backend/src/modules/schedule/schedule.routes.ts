import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import * as ctrl from './schedule.controller.js';

// /api/v1/users/me/schedule-registration, /users/me/shifts, /users/me/shift-assignments,
// /users/me/schedule-registrations
export const myScheduleRouter = Router();
myScheduleRouter.use(auth, requireRole('CTV'));
myScheduleRouter.get('/schedule-registration', ctrl.getMyRegistration);
myScheduleRouter.put('/schedule-registration', ctrl.putMyRegistration);
myScheduleRouter.get('/shifts', ctrl.getMyShifts);
myScheduleRouter.get('/work-history', ctrl.getMyWorkHistory);
myScheduleRouter.delete('/shift-assignments/:assignmentId', ctrl.deleteAssignment);
myScheduleRouter.delete('/schedule-registrations/:registrationId/assignments', ctrl.deleteSeries);
myScheduleRouter.delete('/schedule-registrations/:registrationId/series', ctrl.deleteSeries);

// /api/v1/shifts/:shiftId
export const shiftRouter = Router();
shiftRouter.use(auth);
shiftRouter.get('/:shiftId', ctrl.getShiftById);

// /api/v1/schedule-summary
export const summaryRouter = Router();
summaryRouter.use(auth, requireRole('ADMIN'));
summaryRouter.get('/', ctrl.getSummary);

// /api/v1/work-history (admin aggregate or filtered by accountId)
export const workHistoryRouter = Router();
workHistoryRouter.use(auth, requireRole('ADMIN'));
workHistoryRouter.get('/', ctrl.getWorkHistory);
