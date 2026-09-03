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
  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400 && 'body' in err) {
    res.status(400).json({ error: { code: 'MALFORMED_JSON', message: 'Dữ liệu JSON không hợp lệ' } });
    return;
  }
  if (err?.name === 'MulterError') {
    res.status(400).json({ error: { code: 'FILE_UPLOAD_ERROR', message: err.message } });
    return;
  }
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Lỗi hệ thống' } });
}
