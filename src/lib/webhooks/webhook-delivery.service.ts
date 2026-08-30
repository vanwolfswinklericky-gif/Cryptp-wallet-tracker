// src/lib/webhooks/webhook-delivery.service.ts
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { redis } from '@/lib/redis';
import { WebhookSecurity } from './webhook-security.service';

export class WebhookDeliveryService {
  private static instance: WebhookDeliveryService;
  private security: WebhookSecurity;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAYS = [1000, 5000, 15000]; // 1s, 5s, 15s

  private constructor() {
    this.security = WebhookSecurity.getInstance();
  }

  static getInstance(): WebhookDeliveryService {
    if (!WebhookDeliveryService.instance) {
      WebhookDeliveryService.instance = new WebhookDeliveryService();
    }
    return WebhookDeliveryService.instance;
  }

  /**
   * Deliver signal via webhook - RELIABLE DELIVERY
   */
  async deliver(signal: any): Promise<{
    success: boolean;
    attempt: number;
    statusCode?: number;
    error?: string;
  }> {
    // Get webhook configurations
    const webhooks = await this.getWebhookConfigs(signal.walletId);

    if (webhooks.length === 0) {
      logger.info(`No webhook configured for wallet ${signal.walletId}`);
      return { success: true, attempt: 0 };
    }

    let lastError: string | undefined;

    for (const webhook of webhooks) {
      const result = await this.sendWithRetry(
        webhook,
        this.buildPayload(signal, webhook)
      );

      if (!result.success) {
        lastError = result.error;
        continue;
      }

      // Log successful delivery
      await this.logDelivery(signal, webhook, result);

      return result;
    }

    // All webhooks failed
    await this.logDeliveryFailure(signal, webhooks, lastError);
    return { success: false, attempt: this.MAX_RETRIES, error: lastError };
  }

  private async sendWithRetry(
    webhook: any,
    payload: any,
    attempt: number = 0
  ): Promise<{ success: boolean; attempt: number; statusCode?: number; error?: string }> {
    try {
      const signature = this.security.generateSignature(payload, webhook.secret || '');
      
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Timestamp': Date.now().toString(),
          'X-Webhook-Id': this.security.generateWebhookId(),
          'User-Agent': 'Wallet-Tracker/1.0',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return {
        success: true,
        attempt: attempt + 1,
        statusCode: response.status,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      if (attempt < this.MAX_RETRIES) {
        logger.warn(`Webhook retry ${attempt + 1}/${this.MAX_RETRIES}: ${errorMsg}`);
        await this.delay(this.RETRY_DELAYS[attempt]);
        return this.sendWithRetry(webhook, payload, attempt + 1);
      }

      return {
        success: false,
        attempt: attempt + 1,
        error: errorMsg,
      };
    }
  }

  private buildPayload(signal: any, webhook: any): any {
    return {
      event: this.mapEventType(signal.type),
      wallet: signal.walletAddress,
      token: signal.token,
      tokenAddress: signal.tokenAddress,
      amount: signal.amount.toString(),
      value_usd: signal.valueUsd,
      portfolio_percentage: signal.portfolioPercentage,
      chain: signal.chain,
      txHash: signal.txHash,
      confidence: signal.confidence,
      price: signal.price,
      price_source: signal.priceSource,
      timestamp: signal.confirmedAt?.toISOString() || new Date().toISOString(),
      version: signal.version || 1,
    };
  }

  private mapEventType(type: string): string {
    const map: Record<string, string> = {
      BUY: 'wallet_buy',
      SELL: 'wallet_sell',
      SWAP: 'wallet_swap',
    };
    return map[type] || 'wallet_activity';
  }

  private async getWebhookConfigs(walletId: string): Promise<any[]> {
    return prisma.copyTradeAlert.findMany({
      where: {
        walletId,
        isActive: true,
      },
    });
  }

  private async logDelivery(signal: any, webhook: any, result: any): Promise<void> {
    await prisma.copyTradeAlertLog.create({
      data: {
        alertId: webhook.id,
        txHash: signal.txHash,
        eventType: signal.type,
        tokenAddress: signal.tokenAddress,
        tokenSymbol: signal.token,
        amount: signal.amount,
        valueUsd: signal.valueUsd,
        portfolioPercentage: signal.portfolioPercentage,
        chain: signal.chain,
        webhookStatus: 'SUCCESS',
        webhookResponse: `Status ${result.statusCode}`,
        deliveredAt: new Date(),
      },
    });
  }

  private async logDeliveryFailure(signal: any, webhooks: any[], error?: string): Promise<void> {
    // Log to dead letter
    await prisma.auditLog.create({
      data: {
        userId: null,
        action: 'WEBHOOK_FAILURE',
        entityType: 'Signal',
        entityId: signal.id,
        changes: {
          walletId: signal.walletId,
          txHash: signal.txHash,
          webhookCount: webhooks.length,
          error,
        },
        metadata: {
          requiresReview: true,
          timestamp: new Date().toISOString(),
        },
      },
    });

    logger.error(`Webhook delivery failed for signal ${signal.id}:`, error);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}