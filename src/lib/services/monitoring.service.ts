// src/lib/services/monitoring.service.ts
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { redis } from '@/lib/redis';

export class MonitoringService {
  private static instance: MonitoringService;

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  /**
   * Track system metrics - SELF-AWARENESS
   */
  async trackMetric(
    name: string,
    value: number,
    tags?: Record<string, string>
  ): Promise<void> {
    const key = `metric:${name}`;
    await redis.lpush(key, JSON.stringify({ value, tags, timestamp: Date.now() }));
    await redis.ltrim(key, 0, 10000); // Keep last 10,000

    // Store in database for long-term
    await prisma.auditLog.create({
      data: {
        userId: null,
        action: 'SYSTEM_METRIC',
        entityType: 'Metric',
        entityId: name,
        changes: {
          value,
          tags,
        },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      },
    });
  }

  /**
   * Get metric history - TREND ANALYSIS
   */
  async getMetricHistory(
    name: string,
    hours: number = 24
  ): Promise<Array<{ timestamp: number; value: number }>> {
    const key = `metric:${name}`;
    const data = await redis.lrange(key, 0, -1);
    
    return data
      .map(JSON.parse)
      .filter(d => d.timestamp > Date.now() - hours * 60 * 60 * 1000)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Log signal with full traceability - AUDITABLE
   */
  async logSignal(signal: {
    id: string;
    walletId: string;
    txHash: string;
    type: string;
    confidence: number;
    status: 'CONFIRMED' | 'REJECTED' | 'UNCERTAIN';
    latency: number;
    error?: string;
    metadata: any;
  }): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId: null,
        action: 'SIGNAL',
        entityType: 'Signal',
        entityId: signal.id,
        changes: {
          walletId: signal.walletId,
          txHash: signal.txHash,
          type: signal.type,
          confidence: signal.confidence,
          status: signal.status,
          latency: signal.latency,
        },
        metadata: {
          error: signal.error,
          timestamp: new Date().toISOString(),
          ...signal.metadata,
        },
      },
    });

    // Track metrics
    await this.trackMetric(`signal.${signal.status.toLowerCase()}`, 1, {
      type: signal.type,
      confidence: signal.confidence.toString(),
    });
  }

  /**
   * Add to dead letter queue - AMBIGUOUS/FAILED TRANSACTIONS
   */
  async addToDeadLetter(
    txHash: string,
    chain: string,
    reason: string,
    metadata: any
  ): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId: null,
        action: 'DEAD_LETTER',
        entityType: 'Transaction',
        entityId: txHash,
        changes: {
          chain,
          reason,
        },
        metadata: {
          ...metadata,
          requiresReview: true,
          timestamp: new Date().toISOString(),
        },
      },
    });

    logger.warn(`Dead letter entry for ${txHash}: ${reason}`);
  }

  /**
   * Get dead letter queue - REVIEW SYSTEM
   */
  async getDeadLetterQueue(limit: number = 100): Promise<any[]> {
    return prisma.auditLog.findMany({
      where: {
        action: 'DEAD_LETTER',
        metadata: {
          path: ['requiresReview'],
          equals: true,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Resolve dead letter entry - FEEDBACK LOOP
   */
  async resolveDeadLetter(
    txHash: string,
    resolution: 'FIXED' | 'IGNORED' | 'REPROCESSED',
    notes?: string
  ): Promise<void> {
    await prisma.auditLog.updateMany({
      where: {
        entityId: txHash,
        action: 'DEAD_LETTER',
      },
      data: {
        metadata: {
          resolvedAt: new Date().toISOString(),
          resolution,
          notes,
        },
      },
    });

    logger.info(`Dead letter resolved: ${txHash} -> ${resolution}`);
  }

  /**
   * Get system health - PRODUCTION MONITORING
   */
  async getSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: {
      database: boolean;
      redis: boolean;
      providers: { [key: string]: boolean };
      queue: boolean;
    };
    metrics: {
      signals24h: number;
      signalsRejected24h: number;
      averageLatency: number;
      errorRate: number;
    };
  }> {
    // Check database
    const databaseHealthy = await this.checkDatabaseHealth();
    
    // Check Redis
    const redisHealthy = await this.checkRedisHealth();
    
    // Check providers
    const providersHealthy = await this.checkProviderHealth();
    
    // Check queue
    const queueHealthy = await this.checkQueueHealth();

    // Get metrics
    const metrics = await this.getMetrics(24);

    const allHealthy = databaseHealthy && redisHealthy && 
      Object.values(providersHealthy).every(v => v) && queueHealthy;

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      components: {
        database: databaseHealthy,
        redis: redisHealthy,
        providers: providersHealthy,
        queue: queueHealthy,
      },
      metrics: {
        signals24h: metrics.signalsGenerated,
        signalsRejected24h: metrics.signalsRejected,
        averageLatency: metrics.averageLatency,
        errorRate: metrics.errorRate,
      },
    };
  }

  private async checkDatabaseHealth(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedisHealth(): Promise<boolean> {
    try {
      await redis.ping();
      return true;
    } catch {
      return false;
    }
  }

  private async checkProviderHealth(): Promise<{ [key: string]: boolean }> {
    // Check all providers
    return {
      alchemy: true,
      moralis: true,
      infura: true,
    };
  }

  private async checkQueueHealth(): Promise<boolean> {
    try {
      const status = await QueueService.getInstance().getQueueStatus();
      return status.failed < 100; // Less than 100 failed jobs
    } catch {
      return false;
    }
  }

  private async getMetrics(hours: number): Promise<{
    signalsGenerated: number;
    signalsRejected: number;
    averageLatency: number;
    errorRate: number;
  }> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const signals = await prisma.auditLog.findMany({
      where: {
        action: 'SIGNAL',
        createdAt: { gte: cutoff },
      },
    });

    const total = signals.length;
    const rejected = signals.filter(s => s.changes?.status === 'REJECTED').length;
    const latencies = signals.filter(s => s.changes?.latency).map(s => s.changes.latency);
    const errors = signals.filter(s => s.metadata?.error).length;

    return {
      signalsGenerated: total,
      signalsRejected: rejected,
      averageLatency: latencies.length > 0 
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
        : 0,
      errorRate: total > 0 ? errors / total : 0,
    };
  }
}