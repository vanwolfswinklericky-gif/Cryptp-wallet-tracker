// src/lib/services/reprocessing.service.ts
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { RawEvidenceService } from './raw-evidence.service';
import { TransactionClassifier } from '@/lib/analytics/transaction-classifier';
import { HistoricalPricingService } from './historical-pricing.service';

export class ReprocessingService {
  private static instance: ReprocessingService;
  private rawEvidence: RawEvidenceService;
  private classifier: TransactionClassifier;
  private pricing: HistoricalPricingService;

  private constructor() {
    this.rawEvidence = RawEvidenceService.getInstance();
    this.classifier = TransactionClassifier.getInstance();
    this.pricing = HistoricalPricingService.getInstance();
  }

  static getInstance(): ReprocessingService {
    if (!ReprocessingService.instance) {
      ReprocessingService.instance = new ReprocessingService();
    }
    return ReprocessingService.instance;
  }

  /**
   * Reprocess all evidence with latest version - DESIGNED FOR IMPROVEMENT
   */
  async reprocessAll(version: string, limit: number = 1000): Promise<{
    processed: number;
    success: number;
    failed: number;
  }> {
    logger.info(`Starting reprocessing v${version}...`);
    
    const evidence = await this.rawEvidence.getEvidenceForReprocessing(limit);
    let success = 0;
    let failed = 0;

    for (const ev of evidence) {
      try {
        // Re-classify with latest version
        const classification = this.classifier.classify(
          ev.txHash,
          ev.chain,
          ev.fromAddress,
          ev.toAddress,
          ev.timestamp,
          ev.blockNumber,
          ev.tokenTransfers || [],
          ev.logs || [],
          ev.status
        );

        // Re-validate prices
        if (classification.tokenIn) {
          const price = await this.pricing.getVerifiedPrice(
            classification.tokenIn,
            ev.chain,
            ev.timestamp
          );
          if (price) {
            await this.pricing.storePrice(
              classification.tokenIn,
              ev.chain,
              price.priceUsd,
              ev.timestamp,
              'reprocessing',
              ev.blockNumber
            );
          }
        }

        // Update evidence with new classification
        await prisma.rawTransaction.update({
          where: { txHash: ev.txHash },
          data: {
            metadata: {
              ...(ev.metadata || {}),
              reprocessedAt: new Date().toISOString(),
              reprocessedVersion: version,
              classification,
            },
          },
        });

        success++;
      } catch (error) {
        failed++;
        logger.error(`Failed to reprocess ${ev.txHash}:`, error);
      }
    }

    logger.info(`Reprocessing complete: ${success} success, ${failed} failed`);
    return { processed: evidence.length, success, failed };
  }

  /**
   * Reprocess specific wallet
   */
  async reprocessWallet(walletAddress: string, chain: string): Promise<{
    processed: number;
    success: number;
    failed: number;
  }> {
    const evidence = await this.rawEvidence.getEvidenceByWallet(walletAddress, chain, 1000);
    let success = 0;
    let failed = 0;

    for (const ev of evidence) {
      try {
        // Re-process
        await this.processEvidence(ev);
        success++;
      } catch (error) {
        failed++;
        logger.error(`Failed to reprocess ${ev.txHash}:`, error);
      }
    }

    return { processed: evidence.length, success, failed };
  }

  private async processEvidence(ev: any): Promise<void> {
    // Process evidence with current logic
    // This would update all derived data
    await prisma.rawTransaction.update({
      where: { txHash: ev.txHash },
      data: {
        processedAt: new Date(),
        status: 'PROCESSED',
      },
    });
  }
}