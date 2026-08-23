import { prisma } from '../../shared/prisma.js';

export const createNotification = async (params: {
  accountId: string;
  type?: 'info' | 'success' | 'warning' | 'danger';
  title: string;
  message: string;
  sourceType?: string;
  sourceId?: string;
}) => {
  return prisma.notification.create({
    data: {
      accountId: params.accountId,
      type: params.type || 'info',
      title: params.title,
      message: params.message,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
    },
  });
};

export const getNotificationsByAccount = async (accountId: string) => {
  return prisma.notification.findMany({
    where: { accountId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
};

export const markAllNotificationsRead = async (accountId: string) => {
  return prisma.notification.updateMany({
    where: { accountId, readAt: null },
    data: { readAt: new Date() },
  });
};

export const clearAllNotifications = async (accountId: string) => {
  return prisma.notification.deleteMany({
    where: { accountId },
  });
};
