import { Request, Response, NextFunction } from 'express';
import * as service from './accounts.service.js';
import * as authService from '../auth/auth.service.js';
import {
  createAccountSchema,
  toggleStatusSchema,
  changeRoleSchema,
  adminResetPasswordSchema,
  saveNotesSchema,
  endScheduleSchema,
  updateProfileSchema,
} from './accounts.schemas.js';
import { changePasswordSchema } from '../auth/auth.schemas.js';

export const listAccounts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string | undefined;
    const role = req.query.role as string | undefined;
    const status = req.query.status as string | undefined;

    const list = await service.listAccounts({ search, role, status });
    return res.status(200).json({ data: list });
  } catch (error) {
    next(error);
  }
};

export const getAccountDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const account = await service.getAccountById(req.params.id);
    return res.status(200).json({ data: account });
  } catch (error) {
    next(error);
  }
};

export const createAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = createAccountSchema.parse(req.body);
    const account = await service.createAccount(validated, req.user.id, req.requestId);
    return res.status(201).json({ data: account });
  } catch (error) {
    next(error);
  }
};

export const toggleStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = toggleStatusSchema.parse(req.body);
    const account = await service.toggleAccountStatus(
      req.params.id,
      validated.status,
      req.user.id,
      req.requestId,
    );
    return res.status(200).json({ data: account });
  } catch (error) {
    next(error);
  }
};

export const deleteAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.deleteAccount(req.params.id, req.user.id, req.requestId);
    return res.status(200).json({ data: { message: 'Đã xóa tài khoản thành công' } });
  } catch (error) {
    next(error);
  }
};

export const changeRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = changeRoleSchema.parse(req.body);
    const account = await service.changeAccountRole(
      req.params.id,
      validated.role,
      req.user.id,
      req.requestId,
    );
    return res.status(200).json({ data: account });
  } catch (error) {
    next(error);
  }
};

export const adminResetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = adminResetPasswordSchema.parse(req.body);
    const result = await service.adminResetPassword(
      req.params.id,
      validated.newPassword,
      validated.mustChangePassword,
      req.user.id,
      req.requestId,
    );
    return res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const saveNotes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = saveNotesSchema.parse(req.body);
    const account = await service.saveAccountNotes(
      req.params.id,
      validated.notes,
      req.user.id,
      req.requestId,
    );
    return res.status(200).json({ data: account });
  } catch (error) {
    next(error);
  }
};

export const endSchedule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = endScheduleSchema.parse(req.body);
    const account = await service.endAccountSchedule(
      req.params.id,
      validated.startDate,
      validated.endDate,
      validated.reason,
      req.user.id,
      req.requestId,
    );
    return res.status(200).json({ data: account });
  } catch (error) {
    next(error);
  }
};

// Current User Profile endpoints
export const getMyProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await service.getAccountById(req.user.id);
    return res.status(200).json({ data: user });
  } catch (error) {
    next(error);
  }
};

export const updateMyProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = updateProfileSchema.parse(req.body);
    const updated = await service.updateProfile(req.user.id, validated, req.requestId);
    return res.status(200).json({ data: updated });
  } catch (error) {
    next(error);
  }
};

export const changeMyPassword = async (req: Request, res: Response, next: NextFunction) => {
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

export const updateMyAvatar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    const updated = await service.updateAccountFile(req.user.id, 'AVATAR', file);
    return res.status(200).json({ data: updated });
  } catch (error) {
    next(error);
  }
};

export const updateMyCccdFront = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    const updated = await service.updateAccountFile(req.user.id, 'CCCD_FRONT', file);
    return res.status(200).json({ data: updated });
  } catch (error) {
    next(error);
  }
};

export const updateMyCccdBack = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    const updated = await service.updateAccountFile(req.user.id, 'CCCD_BACK', file);
    return res.status(200).json({ data: updated });
  } catch (error) {
    next(error);
  }
};

export const updateMyCv = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    const updated = await service.updateAccountFile(req.user.id, 'CV', file);
    return res.status(200).json({ data: updated });
  } catch (error) {
    next(error);
  }
};
