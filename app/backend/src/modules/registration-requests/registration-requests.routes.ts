import { Router, type RequestHandler } from 'express';
import multer, { MulterError } from 'multer';
import { requireSession, requireRole } from '../../middleware/auth.middleware.js';
import { requireCsrf } from '../../middleware/csrf.middleware.js';
import { requireAllowedOrigin } from '../../middleware/origin.middleware.js';
import { createRateLimitMiddleware } from '../../middleware/rate-limit.middleware.js';
import { ApiError } from '../../shared/api-error.js';
import { FileStorage } from '../../shared/file-storage.js';
import { config } from '../../config.js';
import { RegistrationRequestsController } from './registration-requests.controller.js';
import { RegistrationRequestsService } from './registration-requests.service.js';

export function createRegistrationRequestsRouter(fileStorage = new FileStorage()): Router {
  const router = Router();
  const service = new RegistrationRequestsService(undefined, fileStorage);
  const controller = new RegistrationRequestsController(service);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { files: 3, fields: 1, fileSize: Math.max(config.FILE_IMAGE_MAX_BYTES, config.FILE_CV_MAX_BYTES) },
  }).fields([
    { name: 'cccdFront', maxCount: 1 },
    { name: 'cccdBack', maxCount: 1 },
    { name: 'cv', maxCount: 1 },
  ]);
  const registrationRateLimit = createRateLimitMiddleware({
    max: 10,
    maxKeys: 10_000,
    windowMs: 15 * 60 * 1000,
    key: (request) => (request.ip ?? 'unknown').slice(0, 64),
  });

  router.post('/', requireAllowedOrigin, registrationRateLimit, requireMultipart, multipart(upload), controller.create);
  router.get('/', requireSession, requireRole('ADMIN'), controller.list);
  router.get('/:requestId', requireSession, requireRole('ADMIN'), controller.detail);
  router.patch('/:requestId', requireSession, requireRole('ADMIN'), requireCsrf, controller.decide);
  return router;
}

const requireMultipart: RequestHandler = (request, _response, next) => {
  if (!request.is('multipart/form-data')) {
    next(new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be multipart/form-data.'));
    return;
  }
  next();
};

function multipart(upload: RequestHandler): RequestHandler {
  return (request, response, next) => upload(request, response, (error?: unknown) => {
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
}
