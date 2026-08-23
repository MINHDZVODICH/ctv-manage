import { Request, Response, NextFunction } from 'express';
import { prisma } from '../shared/prisma.js';
import { hashToken } from '../shared/session.js';
import { ApiError } from '../shared/api-error.js';

export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;

    // 1. From cookie
    if (req.cookies && req.cookies.session_token) {
      token = req.cookies.session_token;
    }

    // 2. From Authorization header
    const authHeader = req.headers.authorization;
    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }

    if (!token) {
      throw ApiError.unauthorized('Vui lòng đăng nhập để tiếp tục');
    }

    const tokenHash = hashToken(token);

    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: {
        account: {
          include: {
            skills: { include: { skill: true } },
            files: { include: { file: true } },
          },
        },
      },
    });

    if (!session) {
      throw ApiError.unauthorized('Phiên đăng nhập không tồn tại');
    }

    if (session.revokedAt) {
      throw ApiError.unauthorized('Phiên đăng nhập đã bị thu hồi');
    }

    if (new Date(session.expiresAt) < new Date()) {
      throw ApiError.unauthorized('Phiên đăng nhập đã hết hạn');
    }

    if (session.account.deletedAt) {
      throw ApiError.unauthorized('Tài khoản đã bị xóa');
    }

    if (session.account.status === 'Vô hiệu hóa') {
      throw ApiError.forbidden('Tài khoản của bạn hiện đang bị vô hiệu hóa');
    }

    req.user = session.account;
    req.session = session;

    next();
  } catch (error) {
    next(error);
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }

    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden(`Yêu cầu quyền truy cập: ${roles.join(' hoặc ')}`));
    }

    next();
  };
};
