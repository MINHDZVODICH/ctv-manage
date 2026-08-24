import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ApiError } from '../shared/api-error.js';
import { logger } from '../shared/logger.js';

export const notFoundMiddleware: RequestHandler = (request, _response, next) => {
  next(new ApiError(404, 'RESOURCE_NOT_FOUND', `No resource matches ${request.method} ${request.originalUrl}.`));
};

export const errorMiddleware: ErrorRequestHandler = (error, _request, response, _next) => {
  const apiError = error instanceof ApiError
    ? error
    : isMalformedJsonError(error)
      ? new ApiError(400, 'INVALID_JSON', 'Malformed JSON request body.')
      : new ApiError(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred.');

  if (!(error instanceof ApiError) && !isMalformedJsonError(error)) {
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

function isMalformedJsonError(error: unknown): error is SyntaxError & { status: number; type: string } {
  return error instanceof SyntaxError
    && (error as { status?: unknown }).status === 400
    && (error as { type?: unknown }).type === 'entity.parse.failed';
}
