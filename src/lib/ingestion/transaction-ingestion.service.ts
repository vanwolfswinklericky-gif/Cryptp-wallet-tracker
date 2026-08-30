// src/lib/ingestion/transaction-ingestion.service.ts
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { TransactionNormalizer } from '@/lib/normalization/transaction-normalizer';
import { ProviderFallbackService } from '@/lib/providers/provider-fallback.service';
import { RawEvidenceService } from '@/lib/services/raw-evidence.service';
import { QueueService } from '@/lib/queue/queue.service';
import { IdempotencyService } from '@/lib/services/idempotency.service';

export class TransactionIngestionService {
  private static instance: TransactionIngestionService;
  private normalizer: TransactionNormalizer;
  private providerFallback: ProviderFallbackService;
  private rawEvidence: RawEvidenceService;
  private queue: QueueService;
  private idempotency: IdempotencyService;

  private constructor() {
    this.normalizer = TransactionNormalizer.getInstance();
    this.providerFallback = ProviderFallbackService.getInstance();
    this.rawEvidence = RawEvidenceService.getInstance();
    this.queue = QueueService.getInstance();
    this.idempotency = IdempotencyService.getInstance();
  }

  static getInstance(): TransactionIngestionService {
    if (!TransactionIngestionService.instance) {
      TransactionIngestionService.instance = new TransactionIngestionService();
    }
    return TransactionIngestionService.instance;
  }

  /**
   * Ingest a single transaction - ENTERPRISE GRADE
   */
  async ingestTransaction(
    chain: string,
    txHash: string,
    provider: string = 'alchemy'
  ): Promise<{
    success: boolean;
    txHash: string;
    status: 'new' | 'duplicate' | 'failed';
    error?: string;
  }> {
    try {
      // 1. Check idempotency
      const isDuplicate = await this.idempotency.isDuplicate(chain, txHash);
      if (isDuplicate) {
        logger.info(`Transaction ${txHash} already processed`);
        return { success: true, txHash, status: 'duplicate' };
      }

      // 2. Get transaction data with fallback
      const result = await this.providerFallback.getDataWithFallback<any>(
        chain,
        txHash,
        'transactions'
      );

      if (!result) {
        throw new Error('No provider returned transaction data');
      }

      // 3. Normalize transaction
      const normalized = this.normalizer.normalize(result.provider, result.data, chain);

      // 4. Store raw evidence
      await this.rawEvidence.storeEvidence({
        chain: normalized.chain,
        txHash: normalized.txHash,
        blockNumber: normalized.blockNumber,
        blockHash: normalized.blockHash,
        timestamp: normalized.timestamp,
        fromAddress: normalized.fromAddress,
        toAddress: normalized.toAddress,
        rawData: result.data,
        provider: result.provider,
        providerId: txHash,
        status: 'PENDING',
        retryCount: 0,
      });

      // 5. Mark as processed
      await this.idempotency.markProcessed(chain, txHash);

      // 6. Queue for processing
      await this.queue.addJob('process_transaction', {
        chain: normalized.chain,
        txHash: normalized.txHash,
        normalized,
        provider: result.provider,
      });

      logger.info(`Transaction ${txHash} ingested successfully`);
      return { success: true, txHash, status: 'new' };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to ingest transaction ${txHash}:`, error);
      return { success: false, txHash, status: 'failed', error: errorMsg };
    }
  }

  /**
   * Ingest multiple transactions - BATCH
   */
  async ingestTransactions(
    chain: string,
    txHashes: string[],
    provider: string = 'alchemy'
  ): Promise<{
    total: number;
    succeeded: number;
    failed: number;
    duplicates: number;
    results: Array<{ txHash: string; status: string; error?: string }>;
  }> {
    const results = [];
    let succeeded = 0;
    let failed = 0;
    let duplicates = 0;

    for (const txHash of txHashes) {
      const result = await this.ingestTransaction(chain, txHash, provider);
      results.push(result);
      
      if (result.status === 'new') succeeded++;
      else if (result.status === 'duplicate') duplicates++;
      else failed++;
    }

    return {
      total: txHashes.length,
      succeeded,
      failed,
      duplicates,
      results,
    };
  }

  /**
   * Ingest wallet transactions - FULL WALLET SYNC
   */
  async ingestWalletTransactions(
    walletAddress: string,
    chain: string,
    fromBlock?: number,
    toBlock?: number,
    provider: string = 'alchemy'
  ): Promise<{
    total: number;
    ingested: number;
    failed: number;
    txHashes: string[];
  }> {
    try {
      // Get wallet transactions
      const result = await this.providerFallback.getDataWithFallback<any>(
        chain,
        walletAddress,
        'history'
      );

      if (!result || !result.data) {
        throw new Error('No transactions found');
      }

      // Extract transaction hashes
      const txHashes = this.extractTxHashes(result.data);
      
      // Ingest each transaction
      const ingestionResult = await this.ingestTransactions(chain, txHashes, provider);
      
      // Queue wallet sync job
      await this.queue.addJob('sync_wallet', {
        walletAddress,
        chain,
        txCount: ingestionResult.succeeded,
      });

      return {
        total: txHashes.length,
        ingested: ingestionResult.succeeded,
        failed: ingestionResult.failed,
        txHashes,
      };
    } catch (error) {
      logger.error(`Failed to ingest wallet ${walletAddress}:`, error);
      return { total: 0, ingested: 0, failed: 0, txHashes: [] };
    }
  }

  private extractTxHashes(data: any): string[] {
    if (Array.isArray(data)) {
      return data.map(tx => tx.hash || tx.txHash).filter(Boolean);
    }
    if (data.transactions) {
      return data.transactions.map((tx: any) => tx.hash || tx.txHash).filter(Boolean);
    }
    if (data.results) {
      return data.results.map((tx: any) => tx.hash || tx.txHash).filter(Boolean);
    }
    return [];
  }
}