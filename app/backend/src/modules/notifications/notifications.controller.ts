import { Request, Response, NextFunction } from 'express';
import * as notificationService from './notifications.service.js';

export const getNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await notificationService.getNotificationsByAccount(req.user.id);
    const formatted = list.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      read: !!n.readAt,
      time: n.createdAt.toLocaleString('vi-VN'),
    }));
    return res.json({ data: formatted });
  } catch (error) {
    next(error);
  }
};

export const markAllRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await notificationService.markAllNotificationsRead(req.user.id);
    return res.json({ data: { success: true } });
  } catch (error) {
    next(error);
  }
};

export const clearNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await notificationService.clearAllNotifications(req.user.id);
    return res.json({ data: { success: true } });
  } catch (error) {
    next(error);
  }
};
