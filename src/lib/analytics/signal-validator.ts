// src/lib/analytics/signal-validator.ts
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { HistoricalPricingService } from '@/lib/services/historical-pricing.service';
import { PortfolioSnapshotService } from '@/lib/services/portfolio-snapshot.service';
import { TransactionType } from './transaction-classifier';

export enum ValidationStatus {
  VALIDATED = 'VALIDATED',
  REJECTED = 'REJECTED',
  PENDING_REVIEW = 'PENDING_REVIEW',
  PARTIALLY_VALIDATED = 'PARTIALLY_VALIDATED',
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  status: 'PASSED' | 'FAILED' | 'WARNING' | 'SKIPPED';
  reason?: string;
  details?: any;
  timestamp: Date;
}

export interface ValidationResult {
  status: ValidationStatus;
  confidence: number;
  checks: ValidationCheck[];
  reasons: string[];
  score: number;
  metadata: {
    txHash: string;
    walletId: string;
    chain: string;
    timestamp: Date;
    duration: number;
  };
  // Additional data for validated signals
  validatedData?: {
    price: number;
    priceSource: string;
    priceConfidence: number;
    portfolioValue: number;
    portfolioPercentage: number;
    snapshotTimestamp: Date;
  };
  // For pending review
  pendingReason?: string;
  missingData?: string[];
}

export class SignalValidator {
  private static instance: SignalValidator;
  private pricing: HistoricalPricingService;
  private portfolio: PortfolioSnapshotService;

  private constructor() {
    this.pricing = HistoricalPricingService.getInstance();
    this.portfolio = PortfolioSnapshotService.getInstance();
  }

  static getInstance(): SignalValidator {
    if (!SignalValidator.instance) {
      SignalValidator.instance = new SignalValidator();
    }
    return SignalValidator.instance;
  }

  /**
   * Validate transaction - RETURNS STATUS, NOT JUST BOOLEAN
   */
  async validate(
    classification: any,
    txData: any,
    walletId: string
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const checks: ValidationCheck[] = [];
    const reasons: string[] = [];
    const missingData: string[] = [];
    let score = 0;
    let isTrade = false;

    // 1. Check if this is a trade
    const tradeCheck = this.checkIsTrade(classification);
    checks.push(tradeCheck);
    if (tradeCheck.passed) {
      score += 15;
      isTrade = true;
    } else {
      reasons.push('Not a trade transaction');
    }

    if (!isTrade) {
      return {
        status: ValidationStatus.REJECTED,
        confidence: 0,
        checks,
        reasons: ['Not a trade transaction - no signal generated'],
        score,
        metadata: {
          txHash: txData.txHash,
          walletId,
          chain: txData.chain,
          timestamp: new Date(),
          duration: Date.now() - startTime,
        },
      };
    }

    // 2. Check transaction confirmation
    const confirmCheck = await this.checkTransactionConfirmed(txData);
    checks.push(confirmCheck);
    if (confirmCheck.passed) {
      score += 15;
    } else {
      reasons.push(confirmCheck.reason || 'Transaction not confirmed');
    }

    // 3. Check amount validity
    const amountCheck = this.checkAmount(classification);
    checks.push(amountCheck);
    if (amountCheck.passed) {
      score += 20;
    } else {
      reasons.push(amountCheck.reason || 'Amount validation failed');
    }

    // 4. Check price validity
    const priceCheck = await this.checkPrice(classification, txData);
    checks.push(priceCheck);
    let validatedPrice: number | undefined;
    let priceSource: string | undefined;
    let priceConfidence: number | undefined;

    if (priceCheck.passed) {
      score += 25;
      validatedPrice = priceCheck.details?.price;
      priceSource = priceCheck.details?.source;
      priceConfidence = priceCheck.details?.confidence;
    } else if (priceCheck.status === 'WARNING') {
      score += 10;
      reasons.push(priceCheck.reason || 'Price validation warning');
      missingData.push('Price data partially available');
    } else {
      reasons.push(priceCheck.reason || 'Price validation failed');
      missingData.push('Price data unavailable');
    }

    // 5. Check portfolio
    const portfolioCheck = await this.checkPortfolio(walletId, classification, txData);
    checks.push(portfolioCheck);
    let portfolioValue: number | undefined;
    let portfolioPercentage: number | undefined;
    let snapshotTimestamp: Date | undefined;

    if (portfolioCheck.passed) {
      score += 20;
      portfolioValue = portfolioCheck.details?.portfolioValue;
      portfolioPercentage = portfolioCheck.details?.percentage;
      snapshotTimestamp = portfolioCheck.details?.snapshotTimestamp;
    } else {
      reasons.push(portfolioCheck.reason || 'Portfolio validation failed');
      missingData.push('Portfolio snapshot unavailable');
    }

    // 6. Check for duplicates
    const duplicateCheck = await this.checkDuplicate(txData.txHash);
    checks.push(duplicateCheck);
    if (duplicateCheck.passed) {
      score += 10;
    } else {
      reasons.push(duplicateCheck.reason || 'Duplicate transaction detected');
    }

    // 7. Check evidence completeness
    const evidenceCheck = this.checkEvidence(txData);
    checks.push(evidenceCheck);
    if (evidenceCheck.passed) {
      score += 10;
    } else {
      reasons.push(evidenceCheck.reason || 'Evidence incomplete');
      missingData.push('Missing evidence');
    }

    // 8. Determine status based on checks and score
    const result = this.determineStatus(
      score,
      checks,
      reasons,
      missingData,
      isTrade
    );

    // Add validated data if applicable
    if (result.status === ValidationStatus.VALIDATED) {
      result.validatedData = {
        price: validatedPrice || 0,
        priceSource: priceSource || 'unknown',
        priceConfidence: priceConfidence || 0,
        portfolioValue: portfolioValue || 0,
        portfolioPercentage: portfolioPercentage || 0,
        snapshotTimestamp: snapshotTimestamp || new Date(),
      };
    }

    // Add missing data for pending review
    if (result.status === ValidationStatus.PENDING_REVIEW) {
      result.pendingReason = this.getPendingReason(checks, reasons);
      result.missingData = missingData;
    }

    result.metadata.duration = Date.now() - startTime;

    // Log validation result
    await this.logValidation(result, txData, walletId);

    return result;
  }

  private checkIsTrade(classification: any): ValidationCheck {
    const tradeTypes = [
      TransactionType.BUY,
      TransactionType.SELL,
      TransactionType.SWAP,
    ];
    const isTrade = tradeTypes.includes(classification.type);
    
    return {
      name: 'Trade Classification',
      passed: isTrade,
      status: isTrade ? 'PASSED' : 'FAILED',
      reason: isTrade ? undefined : `Classification: ${classification.type}`,
      details: { type: classification.type, confidence: classification.confidence },
      timestamp: new Date(),
    };
  }

  private async checkTransactionConfirmed(txData: any): Promise<ValidationCheck> {
    // Check if transaction is confirmed (not pending)
    if (txData.status === 'pending' || txData.status === 'PENDING') {
      return {
        name: 'Transaction Confirmation',
        passed: false,
        status: 'FAILED',
        reason: 'Transaction is still pending',
        details: { status: txData.status },
        timestamp: new Date(),
      };
    }

    // Check if we have enough confirmations
    if (txData.confirmations && txData.confirmations < 3) {
      return {
        name: 'Transaction Confirmation',
        passed: false,
        status: 'WARNING',
        reason: `Only ${txData.confirmations} confirmations, waiting for more`,
        details: { confirmations: txData.confirmations },
        timestamp: new Date(),
      };
    }

    return {
      name: 'Transaction Confirmation',
      passed: true,
      status: 'PASSED',
      details: { confirmations: txData.confirmations || 3 },
      timestamp: new Date(),
    };
  }

  private checkAmount(classification: any): ValidationCheck {
    const amount = classification.amountIn || classification.amountOut || 0;
    
    if (amount <= 0) {
      return {
        name: 'Amount Validation',
        passed: false,
        status: 'FAILED',
        reason: 'Amount must be greater than 0',
        details: { amount },
        timestamp: new Date(),
      };
    }
    
    if (amount > 1e30) {
      return {
        name: 'Amount Validation',
        passed: false,
        status: 'FAILED',
        reason: 'Amount exceeds realistic maximum',
        details: { amount },
        timestamp: new Date(),
      };
    }

    return {
      name: 'Amount Validation',
      passed: true,
      status: 'PASSED',
      details: { amount },
      timestamp: new Date(),
    };
  }

  private async checkPrice(classification: any, txData: any): Promise<ValidationCheck> {
    const tokenAddress = classification.tokenIn || classification.tokenOut;
    if (!tokenAddress) {
      return {
        name: 'Price Validation',
        passed: false,
        status: 'SKIPPED',
        reason: 'No token address available',
        timestamp: new Date(),
      };
    }

    try {
      const price = await this.pricing.getVerifiedPrice(
        tokenAddress,
        txData.chain,
        txData.timestamp
      );

      if (!price) {
        return {
          name: 'Price Validation',
          passed: false,
          status: 'FAILED',
          reason: 'Price not available from any source',
          details: { tokenAddress },
          timestamp: new Date(),
        };
      }

      if (price.confidence < 70) {
        return {
          name: 'Price Validation',
          passed: false,
          status: 'WARNING',
          reason: `Price confidence too low: ${price.confidence}%`,
          details: { confidence: price.confidence, price: price.priceUsd },
          timestamp: new Date(),
        };
      }

      if (price.priceUsd <= 0) {
        return {
          name: 'Price Validation',
          passed: false,
          status: 'FAILED',
          reason: 'Invalid price (zero or negative)',
          details: { price: price.priceUsd },
          timestamp: new Date(),
        };
      }

      return {
        name: 'Price Validation',
        passed: true,
        status: 'PASSED',
        details: {
          price: price.priceUsd,
          source: price.source,
          confidence: price.confidence,
          tokenAddress,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        name: 'Price Validation',
        passed: false,
        status: 'FAILED',
        reason: `Price validation error: ${error instanceof Error ? error.message : 'Unknown'}`,
        timestamp: new Date(),
      };
    }
  }

  private async checkPortfolio(
    walletId: string,
    classification: any,
    txData: any
  ): Promise<ValidationCheck> {
    try {
      const snapshot = await this.portfolio.getSnapshotBeforeTransaction(
        walletId,
        txData.timestamp
      );

      if (!snapshot) {
        return {
          name: 'Portfolio Validation',
          passed: false,
          status: 'FAILED',
          reason: 'No portfolio snapshot available',
          timestamp: new Date(),
        };
      }

      if (snapshot.totalValue <= 0) {
        return {
          name: 'Portfolio Validation',
          passed: false,
          status: 'FAILED',
          reason: 'Invalid portfolio value (zero or negative)',
          details: { totalValue: snapshot.totalValue },
          timestamp: new Date(),
        };
      }

      const tradeValue = classification.valueUsd || 0;
      const percentage = snapshot.totalValue > 0 ? (tradeValue / snapshot.totalValue) * 100 : 0;

      return {
        name: 'Portfolio Validation',
        passed: true,
        status: 'PASSED',
        details: {
          portfolioValue: snapshot.totalValue,
          percentage,
          snapshotTimestamp: snapshot.timestamp,
          holdings: snapshot.holdings?.length || 0,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        name: 'Portfolio Validation',
        passed: false,
        status: 'FAILED',
        reason: `Portfolio validation error: ${error instanceof Error ? error.message : 'Unknown'}`,
        timestamp: new Date(),
      };
    }
  }

  private async checkDuplicate(txHash: string): Promise<ValidationCheck> {
    try {
      const existing = await prisma.transaction.findUnique({
        where: { hash: txHash },
      });

      if (existing) {
        return {
          name: 'Duplicate Check',
          passed: false,
          status: 'FAILED',
          reason: 'Duplicate transaction detected',
          details: { existingId: existing.id },
          timestamp: new Date(),
        };
      }

      return {
        name: 'Duplicate Check',
        passed: true,
        status: 'PASSED',
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        name: 'Duplicate Check',
        passed: false,
        status: 'FAILED',
        reason: `Duplicate check error: ${error instanceof Error ? error.message : 'Unknown'}`,
        timestamp: new Date(),
      };
    }
  }

  private checkEvidence(txData: any): ValidationCheck {
    const missing: string[] = [];

    if (!txData.txHash) missing.push('txHash');
    if (!txData.fromAddress) missing.push('fromAddress');
    if (!txData.blockNumber) missing.push('blockNumber');
    if (!txData.timestamp) missing.push('timestamp');

    if (missing.length > 0) {
      return {
        name: 'Evidence Completeness',
        passed: false,
        status: 'FAILED',
        reason: `Missing evidence: ${missing.join(', ')}`,
        details: { missing },
        timestamp: new Date(),
      };
    }

    return {
      name: 'Evidence Completeness',
      passed: true,
      status: 'PASSED',
      timestamp: new Date(),
    };
  }

  private determineStatus(
    score: number,
    checks: ValidationCheck[],
    reasons: string[],
    missingData: string[],
    isTrade: boolean
  ): ValidationResult {
    const failedChecks = checks.filter(c => c.status === 'FAILED');
    const warningChecks = checks.filter(c => c.status === 'WARNING');
    const criticalFailed = failedChecks.filter(c => 
      c.name === 'Amount Validation' ||
      c.name === 'Price Validation' ||
      c.name === 'Transaction Confirmation'
    );

    // REJECTED: Critical checks failed or not a trade
    if (!isTrade || criticalFailed.length > 0 || score < 40) {
      return {
        status: ValidationStatus.REJECTED,
        confidence: score,
        checks,
        reasons: reasons.length > 0 ? reasons : ['Critical validation checks failed'],
        score,
        metadata: {
          txHash: '',
          walletId: '',
          chain: '',
          timestamp: new Date(),
          duration: 0,
        },
      };
    }

    // VALIDATED: All checks passed with good confidence
    if (failedChecks.length === 0 && warningChecks.length === 0 && score >= 80) {
      return {
        status: ValidationStatus.VALIDATED,
        confidence: score,
        checks,
        reasons: ['All validation checks passed'],
        score,
        metadata: {
          txHash: '',
          walletId: '',
          chain: '',
          timestamp: new Date(),
          duration: 0,
        },
      };
    }

    // PARTIALLY_VALIDATED: All critical checks passed but some non-critical issues
    if (failedChecks.length === 0 && score >= 60) {
      return {
        status: ValidationStatus.PARTIALLY_VALIDATED,
        confidence: score,
        checks,
        reasons: [
          'All critical checks passed, minor issues present',
          ...reasons.filter(r => !r.includes('critical')),
        ],
        score,
        metadata: {
          txHash: '',
          walletId: '',
          chain: '',
          timestamp: new Date(),
          duration: 0,
        },
      };
    }

    // PENDING_REVIEW: Some issues need manual review
    return {
      status: ValidationStatus.PENDING_REVIEW,
      confidence: score,
      checks,
      reasons: reasons.length > 0 ? reasons : ['Transaction requires manual review'],
      score,
      metadata: {
        txHash: '',
        walletId: '',
        chain: '',
        timestamp: new Date(),
        duration: 0,
      },
      pendingReason: this.getPendingReason(checks, reasons),
      missingData,
    };
  }

  private getPendingReason(checks: ValidationCheck[], reasons: string[]): string {
    const warningChecks = checks.filter(c => c.status === 'WARNING');
    const failedChecks = checks.filter(c => c.status === 'FAILED');
    
    if (failedChecks.length > 0) {
      return `Failed checks: ${failedChecks.map(c => c.name).join(', ')}`;
    }
    if (warningChecks.length > 0) {
      return `Warning checks: ${warningChecks.map(c => c.name).join(', ')}`;
    }
    if (reasons.length > 0) {
      return reasons.join('; ');
    }
    return 'Transaction requires manual review';
  }

  private async logValidation(
    result: ValidationResult,
    txData: any,
    walletId: string
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: null,
          action: 'VALIDATION',
          entityType: 'Transaction',
          entityId: txData.txHash || 'unknown',
          changes: {
            status: result.status,
            confidence: result.confidence,
            score: result.score,
            checks: result.checks.map(c => ({
              name: c.name,
              passed: c.passed,
              status: c.status,
              reason: c.reason,
            })),
            reasons: result.reasons,
          },
          metadata: {
            walletId,
            txHash: txData.txHash,
            chain: txData.chain,
            timestamp: new Date().toISOString(),
            duration: result.metadata.duration,
            ...(result.validatedData && { validatedData: result.validatedData }),
            ...(result.pendingReason && { pendingReason: result.pendingReason }),
          },
        },
      });
    } catch (error) {
      logger.error('Failed to log validation:', error);
    }
  }

  /**
   * Get validation statistics - MONITORING
   */
  async getValidationStats(hours: number = 24): Promise<{
    total: number;
    validated: number;
    rejected: number;
    pendingReview: number;
    partiallyValidated: number;
    averageScore: number;
    byType: Record<string, number>;
  }> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const logs = await prisma.auditLog.findMany({
      where: {
        action: 'VALIDATION',
        createdAt: { gte: cutoff },
      },
    });

    const stats = {
      total: logs.length,
      validated: 0,
      rejected: 0,
      pendingReview: 0,
      partiallyValidated: 0,
      averageScore: 0,
      byType: {} as Record<string, number>,
    };

    let totalScore = 0;

    for (const log of logs) {
      const status = log.changes?.status;
      const score = log.changes?.score || 0;
      
      if (status === 'VALIDATED') stats.validated++;
      else if (status === 'REJECTED') stats.rejected++;
      else if (status === 'PENDING_REVIEW') stats.pendingReview++;
      else if (status === 'PARTIALLY_VALIDATED') stats.partiallyValidated++;
      
      totalScore += score;
      
      const type = log.metadata?.type || 'unknown';
      stats.byType[type] = (stats.byType[type] || 0) + 1;
    }

    stats.averageScore = stats.total > 0 ? totalScore / stats.total : 0;

    return stats;
  }
}