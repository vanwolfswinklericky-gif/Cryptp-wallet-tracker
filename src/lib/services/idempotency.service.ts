// src/lib/services/idempotency.service.ts
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';

export class IdempotencyService {
  private static instance: IdempotencyService;

  static getInstance(): IdempotencyService {
    if (!IdempotencyService.instance) {
      IdempotencyService.instance = new IdempotencyService();
    }
    return IdempotencyService.instance;
  }

  /**
   * Check if transaction has been processed - DUPLICATE PROTECTION
   */
  async isDuplicate(
    chain: string,
    txHash: string,
    eventIndex?: number,
    logIndex?: number
  ): Promise<boolean> {
    const key = `processed:${chain}:${txHash}${eventIndex !== undefined ? `:${eventIndex}` : ''}${logIndex !== undefined ? `:${logIndex}` : ''}`;
    
    try {
      const exists = await redis.get(key);
      return exists !== null;
    } catch (error) {
      logger.error('Idempotency check failed:', error);
      return false; // Assume not duplicate to avoid blocking
    }
  }

  /**
   * Mark transaction as processed - PREVENT DUPLICATE WEBHOOKS
   */
  async markProcessed(
    chain: string,
    txHash: string,
    eventIndex?: number,
    logIndex?: number,
    ttl: number = 86400 * 30 // 30 days
  ): Promise<void> {
    const key = `processed:${chain}:${txHash}${eventIndex !== undefined ? `:${eventIndex}` : ''}${logIndex !== undefined ? `:${logIndex}` : ''}`;
    
    try {
      await redis.set(key, '1', ttl);
    } catch (error) {
      logger.error('Failed to mark processed:', error);
    }
  }

  /**
   * Check if signal has been sent - PREVENT DUPLICATE COPY-TRADING SIGNALS
   */
  async isSignalDuplicate(signalId: string): Promise<boolean> {
    const key = `signal:${signalId}`;
    
    try {
      const exists = await redis.get(key);
      return exists !== null;
    } catch (error) {
      logger.error('Signal idempotency check failed:', error);
      return false;
    }
  }

  /**
   * Mark signal as sent
   */
  async markSignalSent(signalId: string, ttl: number = 86400 * 7): Promise<void> {
    const key = `signal:${signalId}`;
    
    try {
      await redis.set(key, '1', ttl);
    } catch (error) {
      logger.error('Failed to mark signal sent:', error);
    }
  }

  /**
   * Get unique identifier for webhook event
   */
  getWebhookId(chain: string, txHash: string, eventType: string): string {
    return `wh_${chain}_${txHash}_${eventType}_${Date.now()}`;
  }
}