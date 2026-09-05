import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import * as controller from './accounts.controller.js';
import * as scheduleCtrl from '../schedule/schedule.controller.js';

export const accountsRouter = Router();

// All routes require ADMIN
accountsRouter.use(auth);
accountsRouter.use(requireRole('ADMIN'));

accountsRouter.get('/', controller.list);
accountsRouter.get('/:id/schedule', scheduleCtrl.getAccountSchedule);
accountsRouter.get('/:id', controller.getById);
accountsRouter.patch('/:id', controller.patch);
accountsRouter.patch('/:id/notes', controller.patchNotes);
accountsRouter.patch('/:id/status', controller.patchStatus);
accountsRouter.delete('/:id', controller.del);
accountsRouter.post('/:id/password-resets', controller.postPasswordReset);

export default accountsRouter;
