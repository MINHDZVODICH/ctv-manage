import type { Request, Response, NextFunction } from 'express';
import { AppError, toErrorBody } from '../shared/errors.js';
import { logger } from '../shared/logger.js';
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json(toErrorBody(err));
    return;
  }
  if (err?.name === 'ZodError') {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Dữ liệu không hợp lệ', details: err.errors } });
    return;
  }
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Lỗi hệ thống' } });
}
