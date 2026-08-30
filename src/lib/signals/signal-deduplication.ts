// src/lib/signals/signal-deduplication.ts
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db/prisma';

export interface DeduplicationResult {
  isDuplicate: boolean;
  existingSignalId?: string;
  existingSignal?: any;
  timestamp: Date;
}

export class SignalDeduplication {
  private static instance: SignalDeduplication;

  static getInstance(): SignalDeduplication {
    if (!SignalDeduplication.instance) {
      SignalDeduplication.instance = new SignalDeduplication();
    }
    return SignalDeduplication.instance;
  }

  /**
   * Check if signal is duplicate - PREVENT DUPLICATE WEBHOOKS
   */
  async isDuplicate(
    chain: string,
    txHash: string,
    eventType: string,
    tokenAddress: string
  ): Promise<DeduplicationResult> {
    // Create composite key
    const key = this.generateKey(chain, txHash, eventType, tokenAddress);

    try {
      // Check Redis cache (fast path)
      const cached = await redis.get(`signal:dedup:${key}`);
      if (cached) {
        const data = JSON.parse(cached);
        return {
          isDuplicate: true,
          existingSignalId: data.signalId,
          existingSignal: data.signal,
          timestamp: new Date(),
        };
      }

      // Check database (slow path, but ensures consistency)
      const existing = await prisma.auditLog.findFirst({
        where: {
          action: 'SIGNAL',
          entityId: {
            contains: `${chain}_${txHash}_${eventType}`,
          },
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existing) {
        // Cache the result
        await redis.set(
          `signal:dedup:${key}`,
          JSON.stringify({
            signalId: existing.entityId,
            signal: existing.changes,
          }),
          86400 * 7 // 7 days TTL
        );

        return {
          isDuplicate: true,
          existingSignalId: existing.entityId,
          existingSignal: existing.changes,
          timestamp: new Date(),
        };
      }

      return {
        isDuplicate: false,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Deduplication check failed:', error);
      return { isDuplicate: false, timestamp: new Date() }; // Allow on error
    }
  }

  /**
   * Mark signal as processed - PREVENT FUTURE DUPLICATES
   */
  async markProcessed(
    chain: string,
    txHash: string,
    eventType: string,
    tokenAddress: string,
    signalId: string,
    signal: any
  ): Promise<void> {
    const key = this.generateKey(chain, txHash, eventType, tokenAddress);

    try {
      // Store in Redis
      await redis.set(
        `signal:dedup:${key}`,
        JSON.stringify({
          signalId,
          signal,
          processedAt: new Date().toISOString(),
        }),
        86400 * 30 // 30 days TTL
      );

      // Store in database (for audit)
      await prisma.auditLog.create({
        data: {
          userId: null,
          action: 'SIGNAL_DEDUP',
          entityType: 'Signal',
          entityId: signalId,
          changes: {
            key,
            chain,
            txHash,
            eventType,
            tokenAddress,
          },
          metadata: {
            processedAt: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      logger.error('Failed to mark signal processed:', error);
    }
  }

  private generateKey(chain: string, txHash: string, eventType: string, tokenAddress: string): string {
    return `${chain}_${txHash}_${eventType}_${tokenAddress}`.toLowerCase();
  }

  /**
   * Get signal history - TRACEABLE
   */
  async getSignalHistory(
    chain: string,
    walletAddress: string,
    limit: number = 100
  ): Promise<any[]> {
    try {
      const logs = await prisma.auditLog.findMany({
        where: {
          action: 'SIGNAL',
          metadata: {
            path: ['walletAddress'],
            equals: walletAddress,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return logs.map(log => ({
        signalId: log.entityId,
        type: log.changes?.type,
        token: log.changes?.token,
        valueUsd: log.changes?.valueUsd,
        confidence: log.changes?.confidence,
        status: log.changes?.status,
        createdAt: log.createdAt,
      }));
    } catch (error) {
      logger.error('Failed to get signal history:', error);
      return [];
    }
  }

  /**
   * Clean up old dedup entries - MAINTENANCE
   */
  async cleanupOldEntries(days: number = 30): Promise<number> {
    try {
      // Clean Redis keys older than days
      const keys = await redis.keys('signal:dedup:*');
      let deleted = 0;

      for (const key of keys) {
        const data = await redis.get(key);
        if (data) {
          const parsed = JSON.parse(data);
          const processedAt = new Date(parsed.processedAt);
          const age = (Date.now() - processedAt.getTime()) / (1000 * 60 * 60 * 24);
          
          if (age > days) {
            await redis.del(key);
            deleted++;
          }
        }
      }

      logger.info(`Cleaned up ${deleted} dedup entries`);
      return deleted;
    } catch (error) {
      logger.error('Failed to cleanup dedup entries:', error);
      return 0;
    }
  }
}