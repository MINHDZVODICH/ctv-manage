import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import * as controller from './accounts.controller.js';
import * as scheduleCtrl from '../schedule/schedule.controller.js';

export const accountsRouter = Router();

// All routes require ADMIN
accountsRouter.use(auth as any);
accountsRouter.use(requireRole('ADMIN') as any);

accountsRouter.get('/', controller.list as any);
accountsRouter.get('/:id/schedule', scheduleCtrl.getAccountSchedule as any);
accountsRouter.get('/:id', controller.getById as any);
accountsRouter.patch('/:id', controller.patch as any);
accountsRouter.patch('/:id/notes', controller.patchNotes as any);
accountsRouter.patch('/:id/status', controller.patchStatus as any);
accountsRouter.delete('/:id', controller.del as any);
accountsRouter.post('/:id/password-resets', controller.postPasswordReset as any);

export default accountsRouter;
