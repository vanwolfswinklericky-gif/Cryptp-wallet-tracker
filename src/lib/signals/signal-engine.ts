// src/lib/signals/signal-engine.ts
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { TransactionClassifier } from '@/lib/analytics/transaction-classifier';
import { SignalValidator, ValidationStatus, ValidationResult } from '@/lib/analytics/signal-validator';
import { PositionEngine } from '@/lib/analytics/position-engine';
import { HistoricalPricingService } from '@/lib/services/historical-pricing.service';
import { WebhookDeliveryService } from '@/lib/webhooks/webhook-delivery.service';
import { IdempotencyService } from '@/lib/services/idempotency.service';
import { DeduplicationService } from '@/lib/services/deduplication.service';

export interface Signal {
  id: string;
  version: number;
  walletId: string;
  walletAddress: string;
  chain: string;
  txHash: string;
  type: string;
  token: string;
  tokenAddress: string;
  amount: number;
  valueUsd: number;
  price: number;
  priceSource: string;
  portfolioPercentage: number;
  confidence: number;
  status: 'DETECTED' | 'VALIDATING' | 'PARTIAL' | 'CONFIRMED' | 'REJECTED' | 'SENT';
  classification: any;
  validation: any;
  metadata: any;
  detectedAt: Date;
  confirmedAt?: Date;
  sentAt?: Date;
}

export interface ClassificationResult {
  type: string;
  confidence: number;
  tokenIn?: string;
  tokenOut?: string;
  amountIn?: number;
  amountOut?: number;
  valueUsd?: number;
  fromAddress?: string;
  toAddress?: string;
  timestamp?: Date;
  blockNumber?: number;
  status?: string;
  metadata?: any;
}

export enum TransactionType {
  BUY = 'BUY',
  SELL = 'SELL',
  SWAP = 'SWAP',
  SEND = 'SEND',
  RECEIVE = 'RECEIVE',
  APPROVAL = 'APPROVAL',
  OTHER = 'OTHER',
}

export class SignalEngine {
  private static instance: SignalEngine;
  private classifier: TransactionClassifier;
  private validator: SignalValidator;
  private positionEngine: PositionEngine;
  private pricing: HistoricalPricingService;
  private webhookDelivery: WebhookDeliveryService;
  private idempotency: IdempotencyService;
  private deduplication: DeduplicationService;

  private constructor() {
    this.classifier = TransactionClassifier.getInstance();
    this.validator = SignalValidator.getInstance();
    this.positionEngine = PositionEngine.getInstance();
    this.pricing = HistoricalPricingService.getInstance();
    this.webhookDelivery = WebhookDeliveryService.getInstance();
    this.idempotency = IdempotencyService.getInstance();
    this.deduplication = DeduplicationService.getInstance();
  }

  static getInstance(): SignalEngine {
    if (!SignalEngine.instance) {
      SignalEngine.instance = new SignalEngine();
    }
    return SignalEngine.instance;
  }

  /**
   * Process transaction into signal - WITH VALIDATION STATUS
   */
  async processTransaction(
    chain: string,
    txHash: string,
    txData: any,
    walletId: string,
    walletAddress: string
  ): Promise<Signal | null> {
    try {
      // 1. Classify transaction
      const classification = this.classifier.classify(
        txHash,
        chain,
        txData.fromAddress,
        txData.toAddress,
        txData.timestamp,
        txData.blockNumber,
        txData.logs || [],
        txData.tokenTransfers || [],
        txData.status
      );

      // Add txHash to classification metadata
      classification.metadata = {
        ...classification.metadata,
        txHash,
        chain,
      };

      // 2. Check if this should generate a signal
      if (!this.shouldGenerateSignal(classification)) {
        await this.storeRejected(classification, null, 'Not a trade signal');
        return null;
      }

      // 3. Validate signal - NOW RETURNS STATUS
      const validation = await this.validator.validate(
        classification,
        txData,
        walletId
      );

      // 4. Handle validation status
      switch (validation.status) {
        case ValidationStatus.VALIDATED:
          // ✅ FULLY VALIDATED - Generate signal
          logger.info(`Transaction ${txHash} validated, generating signal`);
          return await this.generateValidatedSignal(
            classification,
            validation,
            txData,
            walletId,
            walletAddress,
            chain,
            false // not partial
          );

        case ValidationStatus.PARTIALLY_VALIDATED:
          // ⚠️ PARTIALLY VALIDATED - Generate signal with lower confidence
          logger.warn(`Transaction ${txHash} partially validated, generating signal with caution`);
          return await this.generateValidatedSignal(
            classification,
            validation,
            txData,
            walletId,
            walletAddress,
            chain,
            true // partial flag
          );

        case ValidationStatus.PENDING_REVIEW:
          // 🔍 PENDING REVIEW - Store for review, NO SIGNAL
          logger.warn(`Transaction ${txHash} pending review: ${validation.pendingReason}`);
          await this.storeForReview(classification, validation, txData, walletId);
          return null;

        case ValidationStatus.REJECTED:
        default:
          // ❌ REJECTED - No signal
          const reasons = validation.reasons?.join('; ') || 'Validation failed';
          logger.info(`Transaction ${txHash} rejected: ${reasons}`);
          await this.storeRejected(classification, validation, reasons);
          return null;
      }
    } catch (error) {
      logger.error('Signal processing failed:', error);
      return null;
    }
  }

  /**
   * Generate validated signal
   */
  private async generateValidatedSignal(
    classification: ClassificationResult,
    validation: ValidationResult,
    txData: any,
    walletId: string,
    walletAddress: string,
    chain: string,
    partial: boolean = false
  ): Promise<Signal | null> {
    try {
      // Check deduplication
      const dedup = await this.deduplication.isDuplicate(
        chain,
        txData.txHash || txData.hash,
        classification.type,
        classification.tokenOut || classification.tokenIn || ''
      );

      if (dedup.isDuplicate) {
        logger.info(`Duplicate signal prevented for ${txData.txHash || txData.hash}`);
        return null;
      }

      // Get price
      const price = validation.validatedData?.price || 
                   await this.getPrice(classification, txData);

      // Calculate portfolio percentage
      const portfolioPercentage = validation.validatedData?.portfolioPercentage ||
                   await this.calculatePortfolioPercentage(walletId, classification, txData);

      const signal: Signal = {
        id: this.generateSignalId(),
        version: 1,
        walletId,
        walletAddress,
        chain: chain.toUpperCase(),
        txHash: txData.txHash || txData.hash,
        type: classification.type,
        token: classification.tokenOut || classification.tokenIn || 'Unknown',
        tokenAddress: classification.tokenOut || classification.tokenIn || '',
        amount: classification.amountOut || classification.amountIn || 0,
        valueUsd: classification.valueUsd || 0,
        price: price,
        priceSource: validation.validatedData?.priceSource || 'multi-provider',
        portfolioPercentage: portfolioPercentage,
        confidence: validation.confidence || classification.confidence,
        status: partial ? 'PARTIAL' : 'CONFIRMED',
        classification: classification,
        validation: validation,
        metadata: {
          txData: txData,
          blockNumber: txData.blockNumber,
          timestamp: txData.timestamp,
          partial: partial,
          validationStatus: validation.status,
          validatedData: validation.validatedData,
        },
        detectedAt: new Date(),
        confirmedAt: new Date(),
      };

      // Mark as processed in dedup system
      await this.deduplication.markProcessed(
        chain,
        txData.txHash || txData.hash,
        classification.type,
        classification.tokenOut || classification.tokenIn || '',
        signal.id,
        signal
      );

      // Store signal
      await this.storeSignal(signal);

      // Process copy trading alerts
      if (signal.status === 'CONFIRMED' || signal.status === 'PARTIAL') {
        await this.processCopyTradingAlerts(signal, classification);
      }

      // Send webhook if confirmed
      if (signal.status === 'CONFIRMED') {
        await this.webhookDelivery.deliver(signal);
        signal.status = 'SENT';
        signal.sentAt = new Date();
        await this.updateSignal(signal);
      }

      return signal;
    } catch (error) {
      logger.error('Failed to generate validated signal:', error);
      return null;
    }
  }

  /**
   * Process copy trading alerts for a signal
   */
  private async processCopyTradingAlerts(
    signal: Signal,
    classification: ClassificationResult
  ): Promise<void> {
    try {
      // Get all active copy trade alerts for this wallet
      const alerts = await prisma.copyTradeAlert.findMany({
        where: {
          walletId: signal.walletId,
          isActive: true,
          userId: { not: null },
        },
        include: {
          user: true,
        },
      });

      if (alerts.length === 0) {
        return;
      }

      // Filter alerts based on event type and conditions
      const matchingAlerts = this.filterMatchingAlerts(
        alerts,
        signal,
        classification
      );

      if (matchingAlerts.length === 0) {
        logger.debug(`No matching alerts for signal ${signal.id}`);
        return;
      }

      // Process each matching alert
      for (const alert of matchingAlerts) {
        await this.processSingleAlert(alert, signal, classification);
      }
    } catch (error) {
      logger.error('Copy trading alert processing failed:', error);
    }
  }

  /**
   * Filter alerts that match the signal
   */
  private filterMatchingAlerts(
    alerts: any[],
    signal: Signal,
    classification: ClassificationResult
  ): any[] {
    return alerts.filter((alert) => {
      // Check if event type is monitored
      const eventType = signal.type.toUpperCase();
      const isMonitored = this.isEventMonitored(alert, eventType);
      if (!isMonitored) return false;

      // Check value filters
      const valueUsd = signal.valueUsd || classification.valueUsd || 0;
      if (alert.minValueUsd && valueUsd < alert.minValueUsd) return false;
      if (alert.maxValueUsd && valueUsd > alert.maxValueUsd) return false;

      // Check token filters (whitelist/blacklist)
      const token = signal.tokenAddress || classification.tokenOut || classification.tokenIn || '';
      if (alert.tokenWhitelist && alert.tokenWhitelist.length > 0) {
        if (!alert.tokenWhitelist.includes(token)) return false;
      }
      if (alert.tokenBlacklist && alert.tokenBlacklist.length > 0) {
        if (alert.tokenBlacklist.includes(token)) return false;
      }

      return true;
    });
  }

  /**
   * Check if event type is monitored by the alert
   */
  private isEventMonitored(alert: any, eventType: string): boolean {
    const eventMap: Record<string, keyof typeof alert> = {
      BUY: 'monitorBuy',
      SELL: 'monitorSell',
      SWAP: 'monitorSwap',
      SEND: 'monitorSend',
      RECEIVE: 'monitorReceive',
    };

    const monitorKey = eventMap[eventType];
    if (!monitorKey) return false;

    return alert[monitorKey] === true;
  }

  /**
   * Process a single alert
   */
  private async processSingleAlert(
    alert: any,
    signal: Signal,
    classification: ClassificationResult
  ): Promise<void> {
    try {
      // Check rate limiting
      const canAlert = await this.checkRateLimit(alert);
      if (!canAlert) {
        logger.warn(`Rate limit exceeded for alert ${alert.id}`);
        return;
      }

      // Check cooldown
      const canSend = await this.checkCooldown(alert);
      if (!canSend) {
        logger.warn(`Cooldown active for alert ${alert.id}`);
        return;
      }

      // Create alert log
      const alertLog = await prisma.copyTradeAlertLog.create({
        data: {
          alertId: alert.id,
          txHash: signal.txHash,
          eventType: signal.type.toUpperCase(),
          tokenAddress: signal.tokenAddress || classification.tokenOut || classification.tokenIn || '',
          tokenSymbol: signal.token,
          tokenName: signal.token,
          amount: signal.amount,
          valueUsd: signal.valueUsd || classification.valueUsd || 0,
          price: signal.price,
          portfolioPercentage: signal.portfolioPercentage,
          fromAddress: classification.fromAddress || '',
          toAddress: classification.toAddress || '',
          chain: signal.chain,
          webhookStatus: 'PENDING',
          createdAt: new Date(),
        },
      });

      // Update alert stats
      await prisma.copyTradeAlert.update({
        where: { id: alert.id },
        data: {
          totalAlerts: { increment: 1 },
          alertsToday: { increment: 1 },
          lastAlertAt: new Date(),
        },
      });

      // Queue webhook delivery
      await this.queueWebhookDelivery(alert, alertLog, signal, classification);

      logger.info(`Copy trading alert created for ${alert.id}`);
    } catch (error) {
      logger.error(`Failed to process alert ${alert.id}:`, error);
    }
  }

  /**
   * Check rate limiting
   */
  private async checkRateLimit(alert: any): Promise<boolean> {
    if (alert.maxAlertsPerDay <= 0) return true;
    return alert.alertsToday < alert.maxAlertsPerDay;
  }

  /**
   * Check cooldown
   */
  private async checkCooldown(alert: any): Promise<boolean> {
    if (!alert.lastAlertAt || alert.alertCooldown <= 0) return true;
    const now = new Date();
    const cooldownMs = alert.alertCooldown * 1000;
    const timeSinceLast = now.getTime() - alert.lastAlertAt.getTime();
    return timeSinceLast >= cooldownMs;
  }

  /**
   * Queue webhook delivery
   */
  private async queueWebhookDelivery(
    alert: any,
    alertLog: any,
    signal: Signal,
    classification: ClassificationResult
  ): Promise<void> {
    try {
      const payload = this.buildWebhookPayload(alert, alertLog, signal, classification);

      await prisma.webhookQueue.create({
        data: {
          alertId: alert.id,
          payload: payload,
          url: alert.webhookUrl,
          secret: alert.webhookSecret,
          retryCount: 0,
          maxRetries: 3,
          nextRetryAt: new Date(),
          status: 'PENDING',
          createdAt: new Date(),
        },
      });

      // Update alert log status
      await prisma.copyTradeAlertLog.update({
        where: { id: alertLog.id },
        data: {
          webhookStatus: 'PENDING',
        },
      });

      logger.info(`Webhook queued for alert ${alert.id}`);
    } catch (error) {
      logger.error(`Failed to queue webhook for alert ${alert.id}:`, error);
      await prisma.copyTradeAlertLog.update({
        where: { id: alertLog.id },
        data: {
          webhookStatus: 'FAILED',
          webhookError: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Build webhook payload
   */
  private buildWebhookPayload(
    alert: any,
    alertLog: any,
    signal: Signal,
    classification: ClassificationResult
  ): any {
    return {
      id: alertLog.id,
      alertId: alert.id,
      timestamp: new Date().toISOString(),
      wallet: {
        id: signal.walletId,
        address: signal.walletAddress,
        chain: signal.chain,
      },
      transaction: {
        hash: signal.txHash,
        type: signal.type,
        token: {
          address: signal.tokenAddress,
          symbol: signal.token,
        },
        amount: signal.amount,
        valueUsd: signal.valueUsd,
        price: signal.price,
        portfolioPercentage: signal.portfolioPercentage,
      },
      classification: {
        type: classification.type,
        confidence: signal.confidence,
        fromAddress: classification.fromAddress,
        toAddress: classification.toAddress,
        validated: signal.status === 'CONFIRMED' || signal.status === 'SENT',
        partial: signal.status === 'PARTIAL',
      },
      alert: {
        name: alert.name || 'Copy Trade Alert',
        monitorBuy: alert.monitorBuy,
        monitorSell: alert.monitorSell,
        monitorSwap: alert.monitorSwap,
        monitorSend: alert.monitorSend,
        monitorReceive: alert.monitorReceive,
        minValueUsd: alert.minValueUsd,
        maxValueUsd: alert.maxValueUsd,
      },
    };
  }

  /**
   * Store for review (pending validation)
   */
  private async storeForReview(
    classification: ClassificationResult,
    validation: ValidationResult,
    txData: any,
    walletId: string
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: null,
          action: 'PENDING_REVIEW',
          entityType: 'Transaction',
          entityId: txData.txHash || txData.hash || 'unknown',
          changes: {
            classification: classification,
            validation: {
              status: validation.status,
              confidence: validation.confidence,
              reasons: validation.reasons,
              missingData: validation.missingData,
              pendingReason: validation.pendingReason,
            },
          },
          metadata: {
            walletId: walletId,
            txHash: txData.txHash || txData.hash,
            chain: txData.chain,
            timestamp: new Date().toISOString(),
            requiresReview: true,
            pendingReason: validation.pendingReason,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to store transaction for review:', error);
    }
  }

  /**
   * Store rejected transaction
   */
  private async storeRejected(
    classification: ClassificationResult,
    validation: ValidationResult | null,
    reason: string
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: null,
          action: 'SIGNAL_REJECTED',
          entityType: 'Transaction',
          entityId: classification.metadata?.txHash || 'unknown',
          changes: {
            classification: classification,
            validation: validation,
            reason: reason,
          },
          metadata: {
            timestamp: new Date().toISOString(),
            rejected: true,
            rejectionReason: reason,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to store rejected signal:', error);
    }
  }

  /**
   * Should generate signal
   */
  private shouldGenerateSignal(classification: ClassificationResult): boolean {
    const tradeTypes = [
      TransactionType.BUY,
      TransactionType.SELL,
      TransactionType.SWAP,
    ];
    return tradeTypes.includes(classification.type) && 
           (classification.confidence || 0) >= 60;
  }

  /**
   * Get price
   */
  private async getPrice(classification: ClassificationResult, txData: any): Promise<number> {
    const tokenAddress = classification.tokenIn || classification.tokenOut;
    if (!tokenAddress) return 0;

    try {
      const price = await this.pricing.getVerifiedPrice(
        tokenAddress,
        txData.chain || 'ETHEREUM',
        txData.timestamp || new Date()
      );

      return price?.priceUsd || 0;
    } catch (error) {
      logger.error('Failed to get price:', error);
      return 0;
    }
  }

  /**
   * Calculate portfolio percentage
   */
  private async calculatePortfolioPercentage(
    walletId: string,
    classification: ClassificationResult,
    txData: any
  ): Promise<number> {
    try {
      const portfolio = await this.positionEngine.calculatePortfolio(walletId, txData.chain);
      const tradeValue = classification.valueUsd || 0;
      return portfolio.totalValue > 0 ? (tradeValue / portfolio.totalValue) * 100 : 0;
    } catch (error) {
      logger.error('Failed to calculate portfolio percentage:', error);
      return 0;
    }
  }

  /**
   * Generate signal ID
   */
  private generateSignalId(): string {
    return `sig_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  /**
   * Store signal
   */
  private async storeSignal(signal: Signal): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: null,
          action: 'SIGNAL',
          entityType: 'Signal',
          entityId: signal.id,
          changes: {
            version: signal.version,
            walletId: signal.walletId,
            txHash: signal.txHash,
            type: signal.type,
            token: signal.token,
            valueUsd: signal.valueUsd,
            confidence: signal.confidence,
            status: signal.status,
            classification: signal.classification,
            validation: signal.validation,
          },
          metadata: {
            ...signal.metadata,
            signalId: signal.id,
            partial: signal.status === 'PARTIAL',
          },
        },
      });
    } catch (error) {
      logger.error('Failed to store signal:', error);
    }
  }

  /**
   * Update signal
   */
  private async updateSignal(signal: Signal): Promise<void> {
    try {
      await prisma.auditLog.updateMany({
        where: {
          entityId: signal.id,
          action: 'SIGNAL',
        },
        data: {
          changes: {
            ...(signal.status === 'SENT' && { sentAt: signal.sentAt }),
            status: signal.status,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to update signal:', error);
    }
  }

  /**
   * Process pending webhooks
   */
  async processPendingWebhooks(): Promise<void> {
    try {
      const pendingWebhooks = await prisma.webhookQueue.findMany({
        where: {
          status: 'PENDING',
          nextRetryAt: { lte: new Date() },
        },
        include: {
          alert: {
            include: {
              user: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
        take: 100,
      });

      for (const webhook of pendingWebhooks) {
        await this.deliverWebhook(webhook);
      }
    } catch (error) {
      logger.error('Failed to process pending webhooks:', error);
    }
  }

  /**
   * Deliver webhook
   */
  private async deliverWebhook(webhook: any): Promise<void> {
    try {
      // Update status to PROCESSING
      await prisma.webhookQueue.update({
        where: { id: webhook.id },
        data: { status: 'PROCESSING' },
      });

      // Deliver webhook
      const response = await this.webhookDelivery.deliverRaw(
        webhook.url,
        webhook.payload,
        webhook.secret
      );

      // Mark as success
      await prisma.webhookQueue.update({
        where: { id: webhook.id },
        data: {
          status: 'SUCCESS',
          updatedAt: new Date(),
        },
      });

      // Update alert log
      await prisma.copyTradeAlertLog.updateMany({
        where: {
          alertId: webhook.alertId,
          webhookStatus: 'PENDING',
        },
        data: {
          webhookStatus: 'SUCCESS',
          webhookResponse: JSON.stringify(response),
          deliveredAt: new Date(),
        },
      });

      logger.info(`Webhook delivered for ${webhook.id}`);
    } catch (error) {
      logger.error(`Webhook delivery failed for ${webhook.id}:`, error);

      const retryCount = webhook.retryCount + 1;
      const maxRetries = webhook.maxRetries || 3;

      if (retryCount >= maxRetries) {
        // Mark as failed permanently
        await prisma.webhookQueue.update({
          where: { id: webhook.id },
          data: {
            status: 'FAILED',
            error: error instanceof Error ? error.message : 'Unknown error',
            updatedAt: new Date(),
          },
        });

        // Update alert log
        await prisma.copyTradeAlertLog.updateMany({
          where: {
            alertId: webhook.alertId,
            webhookStatus: 'PENDING',
          },
          data: {
            webhookStatus: 'FAILED',
            webhookError: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      } else {
        // Schedule retry with exponential backoff
        const delay = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s
        const nextRetryAt = new Date(Date.now() + delay);

        await prisma.webhookQueue.update({
          where: { id: webhook.id },
          data: {
            retryCount: retryCount,
            nextRetryAt: nextRetryAt,
            status: 'PENDING',
            error: error instanceof Error ? error.message : 'Unknown error',
            updatedAt: new Date(),
          },
        });
      }
    }
  }
}

// ============================================
// DEDUPLICATION SERVICE
// ============================================

export class DeduplicationService {
  private static instance: DeduplicationService;
  private cache: Map<string, { timestamp: number; signalId: string }> = new Map();

  static getInstance(): DeduplicationService {
    if (!DeduplicationService.instance) {
      DeduplicationService.instance = new DeduplicationService();
    }
    return DeduplicationService.instance;
  }

  async isDuplicate(
    chain: string,
    txHash: string,
    type: string,
    token: string
  ): Promise<{ isDuplicate: boolean; existingSignalId?: string }> {
    const key = this.generateKey(chain, txHash, type, token);
    const cached = this.cache.get(key);

    if (cached) {
      // Check if older than 5 minutes (consider expired)
      if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
        return { isDuplicate: true, existingSignalId: cached.signalId };
      }
      this.cache.delete(key);
    }

    // Check database for duplicates
    try {
      const existing = await prisma.auditLog.findFirst({
        where: {
          action: 'SIGNAL',
          entityType: 'Signal',
          changes: {
            path: ['txHash'],
            equals: txHash,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (existing) {
        return {
          isDuplicate: true,
          existingSignalId: existing.entityId,
        };
      }
    } catch (error) {
      logger.error('Failed to check duplicate in database:', error);
    }

    return { isDuplicate: false };
  }

  async markProcessed(
    chain: string,
    txHash: string,
    type: string,
    token: string,
    signalId: string,
    signal: Signal
  ): Promise<void> {
    const key = this.generateKey(chain, txHash, type, token);
    this.cache.set(key, { timestamp: Date.now(), signalId: signalId });
  }

  private generateKey(chain: string, txHash: string, type: string, token: string): string {
    return `${chain}:${txHash}:${type}:${token}`.toLowerCase();
  }
}