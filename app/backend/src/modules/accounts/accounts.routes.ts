import { Router } from 'express';
import { requireRole, requireSession } from '../../middleware/auth.middleware.js';
import { requireCsrf } from '../../middleware/csrf.middleware.js';
import { requireAllowedOrigin } from '../../middleware/origin.middleware.js';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';
import { profileUpload } from './users.routes.js';

export function createAccountsRouter(service: AccountsService): Router {
  const router = Router();
  const controller = new AccountsController(service);
  router.use(requireSession, requireRole('ADMIN'));
  router.get('/', controller.list);
  router.get('/:accountId', controller.detail);
  router.patch('/:accountId', requireAllowedOrigin, requireCsrf, controller.update);
  router.patch('/:accountId/status', requireAllowedOrigin, requireCsrf, controller.updateStatus);
  router.patch('/:accountId/notes', requireAllowedOrigin, requireCsrf, controller.updateNotes);
  router.delete('/:accountId', requireAllowedOrigin, requireCsrf, controller.delete);
  router.post('/:accountId/password-resets', requireAllowedOrigin, requireCsrf, controller.resetPassword);
  router.put('/:accountId/files/:category', requireAllowedOrigin, requireCsrf, profileUpload, controller.replaceAccountFile);
  router.delete('/:accountId/files/:category', requireAllowedOrigin, requireCsrf, controller.deleteAccountFile);
  return router;
}
