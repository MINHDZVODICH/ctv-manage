import { prisma } from '../../shared/prisma.js';
import { logger } from '../../shared/logger.js';

export interface CreateAuditLogParams {
  actorAccountId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  requestId?: string;
  metadata?: any;
}

export const logAudit = async (params: CreateAuditLogParams, db: any = prisma) => {
  try {
    await db.auditLog.create({
      data: {
        actorAccountId: params.actorAccountId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        requestId: params.requestId,
        metadataJson: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });
  } catch (error) {
    logger.error(error, 'Failed to create audit log entry');
  }
};
