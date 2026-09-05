import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import * as ctrl from './schedule.controller.js';

// /api/v1/users/me/schedule, /users/me/schedule-registration, /users/me/shifts, /users/me/work-history
export const myScheduleRouter = Router();
myScheduleRouter.use(auth, requireRole('CTV'));
myScheduleRouter.get('/schedule', ctrl.getMySchedule);
myScheduleRouter.put('/schedule', ctrl.putMySchedule);
myScheduleRouter.delete('/schedule', ctrl.deleteMySchedule);
myScheduleRouter.get('/schedule-registration', ctrl.getMyRegistration);
myScheduleRouter.put('/schedule-registration', ctrl.putMyRegistration);
myScheduleRouter.delete('/schedule-registration', ctrl.deleteMyRegistration);
myScheduleRouter.get('/shifts', ctrl.getMyShifts);
myScheduleRouter.get('/work-history', ctrl.getMyWorkHistory);

// /api/v1/schedule/weekly-summary
export const scheduleRouter = Router();
scheduleRouter.use(auth, requireRole('ADMIN'));
scheduleRouter.get('/weekly-summary', ctrl.getWeeklySummary);

// /api/v1/schedule-summary
export const summaryRouter = Router();
summaryRouter.use(auth, requireRole('ADMIN'));
summaryRouter.get('/', ctrl.getSummary);
summaryRouter.get('/weekly-summary', ctrl.getWeeklySummary);

// /api/v1/work-history (admin aggregate or filtered by accountId)
export const workHistoryRouter = Router();
workHistoryRouter.use(auth, requireRole('ADMIN'));
workHistoryRouter.get('/', ctrl.getWorkHistory);

// /api/v1/shifts/:shiftId
export const shiftRouter = Router();
shiftRouter.use(auth);
shiftRouter.get('/:shiftId', ctrl.getShiftById);
