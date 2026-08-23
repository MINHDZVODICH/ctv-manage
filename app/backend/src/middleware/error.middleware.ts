import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../shared/api-error.js';
import { logger } from '../shared/logger.js';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const requestId = req.requestId || 'req_unknown';

  if (err instanceof ApiError) {
    logger.warn({ err, requestId }, `ApiError [${err.code}]: ${err.message}`);
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details || null,
        requestId,
      },
    });
  }

  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    logger.warn({ details, requestId }, 'Validation Error');
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dữ liệu không hợp lệ',
        details,
        requestId,
      },
    });
  }

  logger.error({ err, requestId }, 'Unhandled Server Error');

  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Đã xảy ra lỗi nội bộ trên hệ thống',
      details: null,
      requestId,
    },
  });
};
