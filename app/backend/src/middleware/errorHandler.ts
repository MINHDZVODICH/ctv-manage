import type { Request, Response, NextFunction } from 'express';
import { AppError, toErrorBody } from '../shared/errors.js';
import { logger } from '../shared/logger.js';
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json(toErrorBody(err));
    return;
  }
  const errorObj = err as { name?: string; message?: string; errors?: unknown; status?: number; body?: unknown } | null | undefined;
  if (errorObj?.name === 'ZodError') {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Dữ liệu không hợp lệ', details: errorObj.errors } });
    return;
  }
  if (err instanceof SyntaxError && errorObj?.status === 400 && 'body' in (errorObj ?? {})) {
    res.status(400).json({ error: { code: 'MALFORMED_JSON', message: 'Dữ liệu JSON không hợp lệ' } });
    return;
  }
  if (errorObj?.name === 'MulterError') {
    res.status(400).json({ error: { code: 'FILE_UPLOAD_ERROR', message: errorObj.message } });
    return;
  }
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Lỗi hệ thống' } });
}
