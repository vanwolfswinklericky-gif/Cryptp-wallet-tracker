// src/lib/ingestion/block-ingestion.service.ts
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { ProviderFallbackService } from '@/lib/providers/provider-fallback.service';
import { TransactionIngestionService } from './transaction-ingestion.service';

export class BlockIngestionService {
  private static instance: BlockIngestionService;
  private providerFallback: ProviderFallbackService;
  private txIngestion: TransactionIngestionService;

  private constructor() {
    this.providerFallback = ProviderFallbackService.getInstance();
    this.txIngestion = TransactionIngestionService.getInstance();
  }

  static getInstance(): BlockIngestionService {
    if (!BlockIngestionService.instance) {
      BlockIngestionService.instance = new BlockIngestionService();
    }
    return BlockIngestionService.instance;
  }

  /**
   * Ingest a block and all its transactions
   */
  async ingestBlock(chain: string, blockNumber: number, provider: string = 'alchemy'): Promise<{
    success: boolean;
    blockNumber: number;
    txCount: number;
    ingested: number;
    failed: number;
  }> {
    try {
      // Get block data
      const result = await this.providerFallback.getDataWithFallback<any>(
        chain,
        `block_${blockNumber}`,
        'block'
      );

      if (!result || !result.data) {
        throw new Error(`Block ${blockNumber} not found`);
      }

      const block = result.data;
      const txHashes = block.transactions?.map((tx: any) => tx.hash || tx) || [];

      // Ingest all transactions
      const ingestionResult = await this.txIngestion.ingestTransactions(
        chain,
        txHashes,
        provider
      );

      return {
        success: true,
        blockNumber,
        txCount: txHashes.length,
        ingested: ingestionResult.succeeded,
        failed: ingestionResult.failed,
      };
    } catch (error) {
      logger.error(`Failed to ingest block ${blockNumber}:`, error);
      return { success: false, blockNumber, txCount: 0, ingested: 0, failed: 0 };
    }
  }

  /**
   * Ingest block range - BATCH PROCESSING
   */
  async ingestBlockRange(
    chain: string,
    fromBlock: number,
    toBlock: number,
    provider: string = 'alchemy'
  ): Promise<{
    total: number;
    succeeded: number;
    failed: number;
    results: Array<{ blockNumber: number; success: boolean; txCount: number }>;
  }> {
    const results = [];
    let succeeded = 0;
    let failed = 0;

    for (let block = fromBlock; block <= toBlock; block++) {
      const result = await this.ingestBlock(chain, block, provider);
      results.push({
        blockNumber: block,
        success: result.success,
        txCount: result.txCount || 0,
      });
      
      if (result.success) succeeded++;
      else failed++;
    }

    return {
      total: toBlock - fromBlock + 1,
      succeeded,
      failed,
      results,
    };
  }
}