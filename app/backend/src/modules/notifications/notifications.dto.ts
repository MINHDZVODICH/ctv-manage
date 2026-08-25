import type { Notification } from '@prisma/client';

export function toNotificationDto(notification: Notification) {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    read: notification.readAt !== null,
    createdAt: notification.createdAt.toISOString(),
  };
}
