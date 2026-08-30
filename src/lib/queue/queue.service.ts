// src/lib/queue/queue.service.ts
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';

export interface QueueJob {
  id: string;
  type: string;
  data: any;
  priority: number;
  attempts: number;
  maxAttempts: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
  error?: string;
}

export class QueueService {
  private static instance: QueueService;
  private readonly QUEUE_PREFIX = 'queue:';
  private readonly PROCESSING_PREFIX = 'processing:';
  private workerCount: number = 0;
  private maxWorkers: number = 10;

  static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }

  /**
   * Add job to queue - ASYNC PROCESSING
   */
  async addJob<T>(type: string, data: T, priority: number = 1): Promise<QueueJob> {
    const job: QueueJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      data,
      priority,
      attempts: 0,
      maxAttempts: 3,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store job in Redis
    await redis.set(
      `${this.QUEUE_PREFIX}${job.id}`,
      JSON.stringify(job),
      86400 * 7 // 7 days TTL
    );

    // Add to priority queue (sorted set)
    await redis.zadd(
      `${this.QUEUE_PREFIX}pending`,
      priority,
      job.id
    );

    logger.info(`Job ${job.id} added to queue: ${type}`);
    return job;
  }

  /**
   * Process jobs from queue - BACKGROUND WORKER
   */
  async processJobs(): Promise<void> {
    while (this.workerCount < this.maxWorkers) {
      this.workerCount++;
      this.processJob().catch(error => {
        logger.error('Worker error:', error);
      });
    }
  }

  private async processJob(): Promise<void> {
    while (true) {
      try {
        // Get highest priority job
        const jobIds = await redis.zrange(
          `${this.QUEUE_PREFIX}pending`,
          0,
          0
        );

        if (jobIds.length === 0) {
          // No jobs, sleep
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        const jobId = jobIds[0];
        
        // Try to claim job (atomic)
        const claimed = await redis.setnx(
          `${this.PROCESSING_PREFIX}${jobId}`,
          Date.now().toString(),
          60 // 60 second lock
        );

        if (!claimed) {
          // Job being processed by another worker
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }

        // Get job data
        const jobData = await redis.get(`${this.QUEUE_PREFIX}${jobId}`);
        if (!jobData) {
          await this.cleanupJob(jobId);
          continue;
        }

        const job = JSON.parse(jobData) as QueueJob;
        job.attempts++;
        job.status = 'PROCESSING';
        job.updatedAt = new Date();

        try {
          // Process job
          await this.executeJob(job);
          
          // Job succeeded
          job.status = 'COMPLETED';
          job.processedAt = new Date();
          await this.completeJob(job);
        } catch (error) {
          job.error = error instanceof Error ? error.message : 'Unknown error';
          
          if (job.attempts >= job.maxAttempts) {
            job.status = 'FAILED';
            await this.failJob(job);
          } else {
            job.status = 'PENDING';
            await this.requeueJob(job);
          }
        }

        await this.cleanupJob(jobId);
      } catch (error) {
        logger.error('Job processing error:', error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  private async executeJob(job: QueueJob): Promise<void> {
    // Implement job execution based on type
    switch (job.type) {
      case 'sync_wallet':
        await this.syncWallet(job.data);
        break;
      case 'process_transaction':
        await this.processTransaction(job.data);
        break;
      case 'calculate_metrics':
        await this.calculateMetrics(job.data);
        break;
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }
  }

  private async syncWallet(data: any): Promise<void> {
    // Implement wallet sync
    logger.info(`Syncing wallet: ${data.walletAddress}`);
  }

  private async processTransaction(data: any): Promise<void> {
    // Implement transaction processing
    logger.info(`Processing transaction: ${data.txHash}`);
  }

  private async calculateMetrics(data: any): Promise<void> {
    // Implement metric calculation
    logger.info(`Calculating metrics for wallet: ${data.walletId}`);
  }

  private async completeJob(job: QueueJob): Promise<void> {
    await redis.del(`${this.QUEUE_PREFIX}${job.id}`);
    await redis.zrem(`${this.QUEUE_PREFIX}pending`, job.id);
    await redis.set(
      `${this.QUEUE_PREFIX}completed:${job.id}`,
      JSON.stringify(job),
      86400 * 7
    );
    logger.info(`Job ${job.id} completed`);
  }

  private async failJob(job: QueueJob): Promise<void> {
    await redis.del(`${this.QUEUE_PREFIX}${job.id}`);
    await redis.zrem(`${this.QUEUE_PREFIX}pending`, job.id);
    await redis.set(
      `${this.QUEUE_PREFIX}failed:${job.id}`,
      JSON.stringify(job),
      86400 * 30
    );
    logger.error(`Job ${job.id} failed after ${job.attempts} attempts: ${job.error}`);
  }

  private async requeueJob(job: QueueJob): Promise<void> {
    // Re-add with lower priority
    await redis.set(
      `${this.QUEUE_PREFIX}${job.id}`,
      JSON.stringify(job),
      86400 * 7
    );
    await redis.zadd(
      `${this.QUEUE_PREFIX}pending`,
      job.priority + 1,
      job.id
    );
    logger.warn(`Job ${job.id} requeued (attempt ${job.attempts}/${job.maxAttempts})`);
  }

  private async cleanupJob(jobId: string): Promise<void> {
    await redis.del(`${this.PROCESSING_PREFIX}${jobId}`);
  }

  /**
   * Get queue status - MONITORING
   */
  async getQueueStatus(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const pending = await redis.zcard(`${this.QUEUE_PREFIX}pending`);
    const processing = await redis.keys(`${this.PROCESSING_PREFIX}*`).then(keys => keys.length);
    const completed = await redis.keys(`${this.QUEUE_PREFIX}completed:*`).then(keys => keys.length);
    const failed = await redis.keys(`${this.QUEUE_PREFIX}failed:*`).then(keys => keys.length);

    return { pending, processing, completed, failed };
  }
}