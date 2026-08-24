import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ApiError } from '../shared/api-error.js';
import { logger } from '../shared/logger.js';

export const notFoundMiddleware: RequestHandler = (request, _response, next) => {
  next(new ApiError(404, 'RESOURCE_NOT_FOUND', `No resource matches ${request.method} ${request.originalUrl}.`));
};

export const errorMiddleware: ErrorRequestHandler = (error, _request, response, _next) => {
  const apiError = error instanceof ApiError
    ? error
    : new ApiError(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred.');

  if (!(error instanceof ApiError)) {
    logger.error(error);
  }

  response.status(apiError.statusCode).json({
    error: {
      code: apiError.code,
      message: apiError.message,
      requestId: response.locals.requestId,
      ...(apiError.details === undefined ? {} : { details: apiError.details }),
    },
  });
};
