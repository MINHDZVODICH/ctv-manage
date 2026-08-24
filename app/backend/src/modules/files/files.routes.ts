import { Router } from 'express';
import { requireSession } from '../../middleware/auth.middleware.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { FilesController } from './files.controller.js';

export function createFilesRouter(service: AccountsService): Router {
  const router = Router();
  const controller = new FilesController(service);
  router.get('/:fileId/content', requireSession, controller.content);
  return router;
}
