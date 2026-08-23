import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service.js';
import {
  loginSchema,
  forgotPasswordSchema,
  verifyOtpSchema,
  changePasswordSchema,
} from './auth.schemas.js';

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = loginSchema.parse(req.body);
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await authService.login(
      validated.email,
      validated.password,
      ipAddress,
      userAgent,
      req.requestId,
    );

    res.cookie('session_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      data: {
        token: result.token,
        user: result.user,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token =
      req.cookies?.session_token ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.substring(7)
        : undefined);

    if (token) {
      await authService.logout(token, req.requestId);
    }

    res.clearCookie('session_token');
    return res.status(200).json({ data: { message: 'Đăng xuất thành công' } });
  } catch (error) {
    next(error);
  }
};

export const getCurrentSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.getCurrentUser(req.user.id);
    return res.status(200).json({ data: { user } });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = forgotPasswordSchema.parse(req.body);
    const result = await authService.sendForgotPasswordOtp(validated.email);
    return res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = verifyOtpSchema.parse(req.body);
    const result = await authService.verifyForgotPasswordOtp(validated.email, validated.otp);

    res.cookie('session_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = changePasswordSchema.parse(req.body);
    const result = await authService.changeSelfPassword(
      req.user.id,
      validated.currentPassword,
      validated.newPassword,
      req.requestId,
    );
    return res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};
