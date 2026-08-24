import type { RequestHandler } from 'express';
import { config } from '../config.js';
import { ApiError } from '../shared/api-error.js';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

export const originMiddleware: RequestHandler = (request, _response, next) => {
  if (safeMethods.has(request.method) || !request.headers.origin) {
    next();
    return;
  }

  if (!config.allowedOrigins.includes(request.headers.origin)) {
    next(new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'Origin is not allowed.'));
    return;
  }

  next();
};
