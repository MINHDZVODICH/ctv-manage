import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors.js';
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) return next(new AppError(401, 'UNAUTHORIZED', 'Chưa đăng nhập'));
    if (!roles.includes(user.role)) return next(new AppError(403, 'FORBIDDEN', 'Không có quyền'));
    next();
  };
}
