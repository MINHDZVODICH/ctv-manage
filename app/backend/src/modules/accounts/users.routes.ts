import type { RequestHandler } from 'express';
import { Router } from 'express';
import multer, { MulterError } from 'multer';
import { config } from '../../config.js';
import { requireSession } from '../../middleware/auth.middleware.js';
import { requireCsrf } from '../../middleware/csrf.middleware.js';
import { requireAllowedOrigin } from '../../middleware/origin.middleware.js';
import { ApiError } from '../../shared/api-error.js';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fields: 0, fileSize: Math.max(config.FILE_IMAGE_MAX_BYTES, config.FILE_CV_MAX_BYTES) },
}).single('file');

export const profileUpload: RequestHandler = (request, response, next) => {
  if (!request.is('multipart/form-data')) {
    next(new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be multipart/form-data.'));
    return;
  }
  upload(request, response, (error?: unknown) => {
    if (error instanceof MulterError && error.code === 'LIMIT_FILE_SIZE') {
      next(new ApiError(413, 'FILE_TOO_LARGE', 'The uploaded file exceeds the configured byte limit.'));
      return;
    }
    if (error instanceof MulterError) {
      next(new ApiError(422, 'INVALID_MULTIPART', 'The multipart request is invalid.'));
      return;
    }
    next(error);
  });
};

export function createUsersRouter(service: AccountsService): Router {
  const router = Router();
  const controller = new AccountsController(service);
  router.use(requireSession);
  router.get('/me', controller.me);
  router.patch('/me', requireAllowedOrigin, requireCsrf, controller.updateMe);
  router.post('/me/password-changes', requireAllowedOrigin, requireCsrf, controller.changePassword);
  router.put('/me/files/:category', requireAllowedOrigin, requireCsrf, profileUpload, controller.replaceMyFile);
  router.delete('/me/files/:category', requireAllowedOrigin, requireCsrf, controller.deleteMyFile);
  return router;
}
