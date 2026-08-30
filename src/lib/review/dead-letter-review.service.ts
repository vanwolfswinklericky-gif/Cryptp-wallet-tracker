// src/lib/review/dead-letter-review.service.ts
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { QueueService } from '@/lib/queue/queue.service';

export class DeadLetterReviewService {
  private static instance: DeadLetterReviewService;
  private queue: QueueService;

  private constructor() {
    this.queue = QueueService.getInstance();
  }

  static getInstance(): DeadLetterReviewService {
    if (!DeadLetterReviewService.instance) {
      DeadLetterReviewService.instance = new DeadLetterReviewService();
    }
    return DeadLetterReviewService.instance;
  }

  /**
   * Add to review queue - UNKNOWN/FIX ME
   */
  async addForReview(data: {
    type: 'TRANSACTION' | 'SIGNAL' | 'WEBHOOK';
    id: string;
    reason: string;
    metadata: any;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
  }): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId: null,
        action: 'REVIEW_QUEUE',
        entityType: data.type,
        entityId: data.id,
        changes: {
          reason: data.reason,
          priority: data.priority,
          status: 'PENDING',
        },
        metadata: {
          ...data.metadata,
          requiresReview: true,
          timestamp: new Date().toISOString(),
        },
      },
    });

    // Queue for processing
    await this.queue.addJob('review_item', {
      type: data.type,
      id: data.id,
      reason: data.reason,
      priority: data.priority,
    });

    logger.info(`Added to review queue: ${data.type} ${data.id} (${data.priority})`);
  }

  /**
   * Get review queue - INVESTIGATE
   */
  async getReviewQueue(
    priority?: 'LOW' | 'MEDIUM' | 'HIGH',
    limit: number = 100
  ): Promise<any[]> {
    const where: any = {
      action: 'REVIEW_QUEUE',
      metadata: {
        path: ['requiresReview'],
        equals: true,
      },
    };

    if (priority) {
      where.changes = {
        path: ['priority'],
        equals: priority,
      };
    }

    return prisma.auditLog.findMany({
      where,
      orderBy: [
        { createdAt: 'asc' },
      ],
      take: limit,
    });
  }

  /**
   * Resolve review item - FEEDBACK LOOP
   */
  async resolveReviewItem(
    entityId: string,
    resolution: 'FIXED' | 'IGNORED' | 'REPROCESSED' | 'TEST_ADDED',
    notes?: string
  ): Promise<void> {
    await prisma.auditLog.updateMany({
      where: {
        entityId,
        action: 'REVIEW_QUEUE',
      },
      data: {
        metadata: {
          resolvedAt: new Date().toISOString(),
          resolution,
          notes,
        },
      },
    });

    // If fixed or reprocessed, add to test suite
    if (resolution === 'FIXED' || resolution === 'REPROCESSED') {
      await this.addToTestSuite(entityId, resolution);
    }

    logger.info(`Review item resolved: ${entityId} -> ${resolution}`);
  }

  private async addToTestSuite(entityId: string, resolution: string): Promise<void> {
    // Get the original item
    const item = await prisma.auditLog.findFirst({
      where: {
        entityId,
        action: 'REVIEW_QUEUE',
      },
    });

    if (!item) return;

    // Add to test suite
    await prisma.auditLog.create({
      data: {
        userId: null,
        action: 'TEST_ADDED',
        entityType: 'Test',
        entityId: `test_${entityId}`,
        changes: {
          originalId: entityId,
          resolution,
          data: item,
        },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      },
    });

    logger.info(`Added to test suite: ${entityId}`);
  }

  /**
   * Get dead letter statistics - MONITORING
   */
  async getStats(): Promise<{
    total: number;
    byPriority: { LOW: number; MEDIUM: number; HIGH: number };
    byType: { TRANSACTION: number; SIGNAL: number; WEBHOOK: number };
    averageAge: number;
  }> {
    const items = await prisma.auditLog.findMany({
      where: {
        action: 'REVIEW_QUEUE',
        metadata: {
          path: ['requiresReview'],
          equals: true,
        },
      },
    });

    const now = Date.now();
    const ages = items.map(item => now - item.createdAt.getTime());

    return {
      total: items.length,
      byPriority: {
        LOW: items.filter(i => i.changes?.priority === 'LOW').length,
        MEDIUM: items.filter(i => i.changes?.priority === 'MEDIUM').length,
        HIGH: items.filter(i => i.changes?.priority === 'HIGH').length,
      },
      byType: {
        TRANSACTION: items.filter(i => i.entityType === 'TRANSACTION').length,
        SIGNAL: items.filter(i => i.entityType === 'SIGNAL').length,
        WEBHOOK: items.filter(i => i.entityType === 'WEBHOOK').length,
      },
      averageAge: ages.length > 0 ? ages.reduce((a, b) => a + b, 0) / ages.length : 0,
    };
  }
}