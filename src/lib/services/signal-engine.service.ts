// src/lib/services/signal-engine.service.ts
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { TransactionClassifier, TransactionType, ClassificationResult } from '@/lib/analytics/transaction-classifier';
import { PriceValidationService } from './price-validation.service';
import { PortfolioSnapshotService } from './portfolio-snapshot.service';

export interface Signal {
  id: string;
  walletId: string;
  chain: string;
  txHash: string;
  eventType: string;
  token: string;
  tokenAddress: string;
  amount: number;
  valueUsd: number;
  portfolioPercentage: number;
  confidence: number;
  status: 'DETECTED' | 'PROCESSING' | 'CONFIRMED' | 'REJECTED';
  classification: ClassificationResult;
  metadata: Record<string, any>;
  detectedAt: Date;
  confirmedAt?: Date;
}

export class SignalEngine {
  private static instance: SignalEngine;
  private classifier: TransactionClassifier;
  private priceValidator: PriceValidationService;
  private portfolioService: PortfolioSnapshotService;

  private constructor() {
    this.classifier = TransactionClassifier.getInstance();
    this.priceValidator = PriceValidationService.getInstance();
    this.portfolioService = PortfolioSnapshotService.getInstance();
  }

  static getInstance(): SignalEngine {
    if (!SignalEngine.instance) {
      SignalEngine.instance = new SignalEngine();
    }
    return SignalEngine.instance;
  }

  async processTransaction(
    walletId: string,
    chain: string,
    txData: any,
    tokenTransfers: any[],
    logs: any[]
  ): Promise<Signal | null> {
    try {
      // 1. Classify transaction
      const classification = this.classifier.classify(txData, tokenTransfers, logs);
      
      // 2. If not a trade, reject early
      if (!this.isTrade(classification)) {
        await this.storeRejectedSignal(walletId, chain, txData.hash, classification);
        return null;
      }

      // 3. Validate price
      const priceResult = await this.priceValidator.validatePrice(
        classification.tokenIn || '',
        chain,
        new Date(txData.timestamp)
      );

      if (!priceResult || priceResult.confidence < 60) {
        logger.warn(`Price validation failed for ${txData.hash}`);
        return null;
      }

      // 4. Capture portfolio snapshot before trade
      const snapshot = await this.portfolioService.getSnapshotBeforeTransaction(
        walletId,
        new Date(txData.timestamp)
      );

      // 5. Calculate portfolio percentage
      const portfolioPercentage = this.calculatePortfolioPercentage(
        classification.valueUsd || 0,
        snapshot?.totalValue || 0
      );

      // 6. Build signal
      const signal: Signal = {
        id: this.generateSignalId(),
        walletId,
        chain,
        txHash: txData.hash,
        eventType: classification.type,
        token: classification.tokenOut || '',
        tokenAddress: classification.tokenOut || '',
        amount: classification.amountOut || 0,
        valueUsd: classification.valueUsd || 0,
        portfolioPercentage,
        confidence: this.calculateSignalConfidence(classification, priceResult, snapshot),
        status: 'CONFIRMED',
        classification,
        metadata: {
          price: priceResult.price,
          priceSources: priceResult.sources,
          snapshot: snapshot || null,
        },
        detectedAt: new Date(),
        confirmedAt: new Date(),
      };

      // 7. Store signal
      await this.storeSignal(signal);

      // 8. Send webhook if confirmed
      if (signal.confidence >= 80) {
        await this.sendWebhook(signal);
      }

      return signal;
    } catch (error) {
      logger.error('Signal processing error:', error);
      return null;
    }
  }

  private isTrade(classification: ClassificationResult): boolean {
    return [
      TransactionType.BUY,
      TransactionType.SELL,
      TransactionType.SWAP,
    ].includes(classification.type);
  }

  private calculatePortfolioPercentage(tradeValue: number, portfolioValue: number): number {
    if (portfolioValue === 0) return 0;
    return (tradeValue / portfolioValue) * 100;
  }

  private calculateSignalConfidence(
    classification: ClassificationResult,
    priceResult: any,
    snapshot: any
  ): number {
    let confidence = classification.confidence;
    
    // Price confidence affects overall confidence
    if (priceResult) {
      confidence = (confidence * 0.6) + (priceResult.confidence * 0.4);
    }
    
    // Portfolio snapshot adds confidence
    if (snapshot) {
      confidence += 10;
    }
    
    return Math.min(Math.max(confidence, 0), 100);
  }

  private generateSignalId(): string {
    return `sig_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  private async storeSignal(signal: Signal) {
    await prisma.copyTradeAlertLog.create({
      data: {
        alertId: 'pending', // Actual alert ID from webhook config
        txHash: signal.txHash,
        eventType: signal.eventType,
        tokenAddress: signal.tokenAddress,
        tokenSymbol: signal.token,
        amount: signal.amount,
        valueUsd: signal.valueUsd,
        portfolioPercentage: signal.portfolioPercentage,
        chain: signal.chain,
        webhookStatus: 'PENDING',
      },
    });
  }

  private async storeRejectedSignal(
    walletId: string,
    chain: string,
    txHash: string,
    classification: ClassificationResult
  ) {
    // Store rejected signal for dead-letter analysis
    await prisma.auditLog.create({
      data: {
        userId: null,
        action: 'REJECTED_SIGNAL',
        entityType: 'Transaction',
        entityId: txHash,
        changes: {
          walletId,
          chain,
          classification,
          reason: 'Not a trade',
        },
        metadata: {
          rejectionReason: classification.reasons,
        },
      },
    });
  }

  private async sendWebhook(signal: Signal) {
    // Implement webhook delivery with retries
    const payload = {
      event: signal.eventType,
      wallet: signal.walletId,
      token: signal.token,
      tokenAddress: signal.tokenAddress,
      amount: signal.amount.toString(),
      value_usd: signal.valueUsd,
      portfolio_percentage: signal.portfolioPercentage,
      chain: signal.chain,
      txHash: signal.txHash,
      confidence: signal.confidence,
      timestamp: signal.confirmedAt?.toISOString(),
    };

    logger.info('Webhook payload:', payload);
    // Implement actual webhook delivery
  }
}