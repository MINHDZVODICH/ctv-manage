import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import * as controller from './operations.controller.js';

export const operationsRouter = Router();

operationsRouter.use(auth);
operationsRouter.use(requireRole('ADMIN'));

operationsRouter.get('/snapshot-runs', controller.listSnapshotRuns);

export default operationsRouter;
