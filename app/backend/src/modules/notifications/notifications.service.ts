import type { PrismaClient } from '@prisma/client';
import { ApiError } from '../../shared/api-error.js';
import { prisma } from '../../shared/prisma.js';
import { toNotificationDto } from './notifications.dto.js';
import type { NotificationListQuery } from './notifications.schemas.js';

export class NotificationsService {
  constructor(private readonly client: PrismaClient = prisma, private readonly now: () => Date = () => new Date()) {}

  async list(accountId: string, query: NotificationListQuery) {
    const where = { accountId, ...(query.read === undefined ? {} : { readAt: query.read ? { not: null } : null }) };
    const [items, total] = await this.client.$transaction([
      this.client.notification.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.client.notification.count({ where }),
    ]);
    return { items: items.map(toNotificationDto), page: query.page, pageSize: query.pageSize, total };
  }

  async setRead(accountId: string, notificationId: string, read: boolean) {
    const result = await this.client.notification.updateMany({
      where: { id: notificationId, accountId }, data: { readAt: read ? this.now() : null },
    });
    if (result.count !== 1) throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'Notification was not found.');
    const notification = await this.client.notification.findFirstOrThrow({ where: { id: notificationId, accountId } });
    return toNotificationDto(notification);
  }
}
