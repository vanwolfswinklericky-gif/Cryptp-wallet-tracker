// src/lib/services/copy-trading.service.ts
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

export interface CopyTradeAlert {
  event: 'wallet_buy' | 'wallet_sell' | 'wallet_swap' | 'wallet_send' | 'wallet_receive';
  wallet: string;
  token: string;
  tokenAddress: string;
  amount: string;
  value_usd: number;
  portfolio_percentage?: number;
  chain?: string;
  txHash: string;
  timestamp: string;
}

export class CopyTradingService {
  private static instance: CopyTradingService;

  static getInstance(): CopyTradingService {
    if (!CopyTradingService.instance) {
      CopyTradingService.instance = new CopyTradingService();
    }
    return CopyTradingService.instance;
  }

  /**
   * ✅ Create a copy-trade alert
   */
  async createAlert(
    userId: string,
    data: {
      walletId: string;
      webhookUrl: string;
      webhookSecret?: string;
      monitorBuy?: boolean;
      monitorSell?: boolean;
      monitorSwap?: boolean;
      minValueUsd?: number;
      tokenWhitelist?: string[];
      tokenBlacklist?: string[];
      maxAlertsPerDay?: number;
      alertCooldown?: number;
    }
  ) {
    // Validate wallet ownership
    const wallet = await prisma.wallet.findFirst({
      where: {
        id: data.walletId,
        userId,
        isDeleted: false,
      },
    });

    if (!wallet) {
      throw new Error('Wallet not found or not owned by user');
    }

    // Check if alert already exists
    const existing = await prisma.copyTradeAlert.findUnique({
      where: {
        userId_walletId: {
          userId,
          walletId: data.walletId,
        },
      },
    });

    if (existing) {
      throw new Error('Alert already exists for this wallet');
    }

    // Create alert
    const alert = await prisma.copyTradeAlert.create({
      data: {
        userId,
        walletId: data.walletId,
        webhookUrl: data.webhookUrl,
        webhookSecret: data.webhookSecret,
        monitorBuy: data.monitorBuy ?? true,
        monitorSell: data.monitorSell ?? true,
        monitorSwap: data.monitorSwap ?? true,
        minValueUsd: data.minValueUsd,
        tokenWhitelist: data.tokenWhitelist || [],
        tokenBlacklist: data.tokenBlacklist || [],
        maxAlertsPerDay: data.maxAlertsPerDay || 50,
        alertCooldown: data.alertCooldown || 60,
        isActive: true,
      },
    });

    logger.info('Copy-trade alert created', { userId, walletId: data.walletId });

    return alert;
  }

  /**
   * ✅ Process transaction and send webhook alerts
   */
  async processTransaction(
    walletAddress: string,
    txData: {
      txHash: string;
      chain: string;
      eventType: 'BUY' | 'SELL' | 'SWAP' | 'SEND' | 'RECEIVE';
      tokenAddress: string;
      tokenSymbol: string;
      tokenName?: string;
      amount: number;
      valueUsd: number;
      fromAddress?: string;
      toAddress?: string;
      price?: number;
      portfolioPercentage?: number;
    }
  ) {
    try {
      // Find all active alerts for this wallet
      const alerts = await prisma.copyTradeAlert.findMany({
        where: {
          wallet: {
            address: walletAddress,
            isDeleted: false,
          },
          isActive: true,
        },
      });

      if (alerts.length === 0) {
        logger.debug(`No copy-trade alerts for wallet ${walletAddress}`);
        return;
      }

      // Process each alert
      for (const alert of alerts) {
        await this.processAlert(alert, txData);
      }
    } catch (error) {
      logger.error('Failed to process transaction for copy-trading:', error);
    }
  }

  /**
   * ✅ Process a single alert
   */
  private async processAlert(alert: any, txData: any) {
    try {
      // Check if this transaction type is monitored
      const eventMap: Record<string, string> = {
        BUY: 'monitorBuy',
        SELL: 'monitorSell',
        SWAP: 'monitorSwap',
      };

      const monitorField = eventMap[txData.eventType];
      if (!monitorField || !alert[monitorField]) {
        return;
      }

      // Check value threshold
      if (alert.minValueUsd && txData.valueUsd < alert.minValueUsd) {
        return;
      }

      // Check token whitelist/blacklist
      if (alert.tokenWhitelist.length > 0) {
        if (!alert.tokenWhitelist.includes(txData.tokenSymbol)) {
          return;
        }
      }
      if (alert.tokenBlacklist.length > 0) {
        if (alert.tokenBlacklist.includes(txData.tokenSymbol)) {
          return;
        }
      }

      // Rate limiting
      if (alert.alertsToday >= alert.maxAlertsPerDay) {
        logger.warn(`Alert ${alert.id} rate limit reached`);
        return;
      }

      if (alert.lastAlertAt) {
        const secondsSinceLast = (Date.now() - alert.lastAlertAt.getTime()) / 1000;
        if (secondsSinceLast < alert.alertCooldown) {
          return;
        }
      }

      // Build webhook payload
      const payload: CopyTradeAlert = {
        event: `wallet_${txData.eventType.toLowerCase()}` as any,
        wallet: alert.wallet.address,
        token: txData.tokenSymbol,
        tokenAddress: txData.tokenAddress,
        amount: txData.amount.toString(),
        value_usd: txData.valueUsd,
        portfolio_percentage: txData.portfolioPercentage,
        chain: txData.chain,
        txHash: txData.txHash,
        timestamp: new Date().toISOString(),
      };

      // Send webhook
      const webhookResult = await this.sendWebhook(
        alert.webhookUrl,
        payload,
        alert.webhookSecret
      );

      // Log the alert
      await prisma.copyTradeAlertLog.create({
        data: {
          alertId: alert.id,
          txHash: txData.txHash,
          eventType: txData.eventType,
          tokenAddress: txData.tokenAddress,
          tokenSymbol: txData.tokenSymbol,
          tokenName: txData.tokenName || txData.tokenSymbol,
          amount: txData.amount,
          valueUsd: txData.valueUsd,
          price: txData.price,
          portfolioPercentage: txData.portfolioPercentage,
          fromAddress: txData.fromAddress,
          toAddress: txData.toAddress,
          chain: txData.chain,
          webhookStatus: webhookResult.success ? 'SUCCESS' : 'FAILED',
          webhookResponse: webhookResult.response,
          webhookError: webhookResult.error,
          deliveredAt: webhookResult.success ? new Date() : undefined,
        },
      });

      // Update alert stats
      await prisma.copyTradeAlert.update({
        where: { id: alert.id },
        data: {
          alertsToday: alert.alertsToday + 1,
          lastAlertAt: new Date(),
          totalAlerts: alert.totalAlerts + 1,
          lastError: webhookResult.success ? null : webhookResult.error,
        },
      });

      logger.info(`Webhook sent for alert ${alert.id}`, {
        success: webhookResult.success,
        event: txData.eventType,
        valueUsd: txData.valueUsd,
      });
    } catch (error) {
      logger.error(`Failed to process alert ${alert.id}:`, error);
    }
  }

  /**
   * ✅ Send webhook with HMAC signature
   */
  private async sendWebhook(
    url: string,
    payload: CopyTradeAlert,
    secret?: string
  ): Promise<{ success: boolean; response?: string; error?: string }> {
    try {
      const body = JSON.stringify(payload);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Crypto-Wallet-Tracker/1.0',
      };

      // Add HMAC signature if secret provided
      if (secret) {
        const signature = crypto
          .createHmac('sha256', secret)
          .update(body)
          .digest('hex');
        headers['X-Webhook-Signature'] = signature;
        headers['X-Webhook-Timestamp'] = Date.now().toString();
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }

      return {
        success: true,
        response: responseText,
      };
    } catch (error) {
      logger.error('Webhook delivery failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * ✅ Get alerts for a user
   */
  async getUserAlerts(userId: string) {
    return prisma.copyTradeAlert.findMany({
      where: { userId },
      include: {
        wallet: {
          select: {
            address: true,
            chain: true,
            label: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * ✅ Get alert logs
   */
  async getAlertLogs(alertId: string, limit: number = 50) {
    return prisma.copyTradeAlertLog.findMany({
      where: { alertId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * ✅ Update alert
   */
  async updateAlert(alertId: string, userId: string, data: any) {
    // Verify ownership
    const alert = await prisma.copyTradeAlert.findFirst({
      where: { id: alertId, userId },
    });

    if (!alert) {
      throw new Error('Alert not found');
    }

    return prisma.copyTradeAlert.update({
      where: { id: alertId },
      data,
    });
  }

  /**
   * ✅ Delete alert
   */
  async deleteAlert(alertId: string, userId: string) {
    // Verify ownership
    const alert = await prisma.copyTradeAlert.findFirst({
      where: { id: alertId, userId },
    });

    if (!alert) {
      throw new Error('Alert not found');
    }

    return prisma.copyTradeAlert.delete({
      where: { id: alertId },
    });
  }

  /**
   * ✅ Reset daily alert counters (should be called via cron job)
   */
  async resetDailyCounters() {
    await prisma.copyTradeAlert.updateMany({
      where: {
        alertsToday: { gt: 0 },
      },
      data: {
        alertsToday: 0,
      },
    });
    logger.info('Daily alert counters reset');
  }

  /**
   * ✅ Retry failed webhooks
   */
  async retryFailedWebhooks() {
    const failed = await prisma.copyTradeAlertLog.findMany({
      where: {
        webhookStatus: 'FAILED',
        retryCount: { lt: 3 },
        createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    for (const log of failed) {
      // Find the alert
      const alert = await prisma.copyTradeAlert.findUnique({
        where: { id: log.alertId },
        include: { wallet: true },
      });

      if (!alert) continue;

      // Build payload
      const payload: CopyTradeAlert = {
        event: `wallet_${log.eventType.toLowerCase()}` as any,
        wallet: alert.wallet.address,
        token: log.tokenSymbol,
        tokenAddress: log.tokenAddress,
        amount: log.amount.toString(),
        value_usd: log.valueUsd,
        chain: log.chain || undefined,
        txHash: log.txHash,
        timestamp: log.createdAt.toISOString(),
      };

      // Retry
      const result = await this.sendWebhook(
        alert.webhookUrl,
        payload,
        alert.webhookSecret || undefined
      );

      // Update log
      await prisma.copyTradeAlertLog.update({
        where: { id: log.id },
        data: {
          retryCount: log.retryCount + 1,
          webhookStatus: result.success ? 'SUCCESS' : 'FAILED',
          webhookResponse: result.response,
          webhookError: result.error,
          deliveredAt: result.success ? new Date() : undefined,
        },
      });
    }
  }
}

export const copyTradingService = CopyTradingService.getInstance();