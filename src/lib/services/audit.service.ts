// src/lib/services/audit.service.ts
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

export interface AuditLogData {
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: any;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
}

export const AuditService = {
  async log(data: AuditLogData): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
          changes: data.changes || {},
          metadata: data.metadata || {},
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        },
      });
    } catch (error) {
      logger.error('Failed to create audit log:', error);
      // Don't throw - audit logging shouldn't break the app
    }
  },
};