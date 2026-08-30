// src/lib/services/reconciliation.service.ts
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { RawEvidenceService } from './raw-evidence.service';

export class ReconciliationService {
  private static instance: ReconciliationService;

  static getInstance(): ReconciliationService {
    if (!ReconciliationService.instance) {
      ReconciliationService.instance = new ReconciliationService();
    }
    return ReconciliationService.instance;
  }

  /**
   * Reconcile wallet data - CATCH SILENT CORRUPTION
   */
  async reconcileWallet(walletId: string, chain: string): Promise<{
    matched: boolean;
    differences: {
      databaseBalance: number;
      onChainBalance: number;
      diff: number;
      missingTransactions: string[];
      extraTransactions: string[];
    };
  }> {
    try {
      // Get database state
      const dbBalance = await this.getDatabaseBalance(walletId);
      const dbTransactions = await this.getDatabaseTransactions(walletId);
      
      // Get on-chain state
      const onChainBalance = await this.getOnChainBalance(walletId, chain);
      const onChainTxs = await this.getOnChainTransactions(walletId, chain);
      
      // Compare
      const missingTransactions = this.findMissingTransactions(dbTransactions, onChainTxs);
      const extraTransactions = this.findExtraTransactions(dbTransactions, onChainTxs);
      const diff = dbBalance - onChainBalance;
      
      const matched = Math.abs(diff) < 0.01 && missingTransactions.length === 0 && extraTransactions.length === 0;
      
      if (!matched) {
        logger.warn(`Reconciliation failed for wallet ${walletId}: diff=${diff}, missing=${missingTransactions.length}, extra=${extraTransactions.length}`);
        
        // Log reconciliation failure
        await prisma.auditLog.create({
          data: {
            userId: null,
            action: 'RECONCILIATION_FAILURE',
            entityType: 'Wallet',
            entityId: walletId,
            changes: {
              chain,
              dbBalance,
              onChainBalance,
              diff,
              missingTransactions,
              extraTransactions,
            },
            metadata: {
              timestamp: new Date().toISOString(),
              requiresInvestigation: true,
            },
          },
        });
      }
      
      return {
        matched,
        differences: {
          databaseBalance: dbBalance,
          onChainBalance,
          diff,
          missingTransactions,
          extraTransactions,
        },
      };
    } catch (error) {
      logger.error(`Reconciliation failed for wallet ${walletId}:`, error);
      return {
        matched: false,
        differences: {
          databaseBalance: 0,
          onChainBalance: 0,
          diff: 0,
          missingTransactions: [],
          extraTransactions: [],
        },
      };
    }
  }

  private async getDatabaseBalance(walletId: string): Promise<number> {
    const latestMetric = await prisma.walletMetric.findFirst({
      where: { walletId },
      orderBy: { timestamp: 'desc' },
    });
    return latestMetric?.portfolioValue || 0;
  }

  private async getOnChainBalance(walletId: string, chain: string): Promise<number> {
    // Implement on-chain balance fetching
    // This would call your provider
    return 0;
  }

  private async getDatabaseTransactions(walletId: string): Promise<string[]> {
    const transactions = await prisma.transaction.findMany({
      where: { walletId },
      select: { hash: true },
    });
    return transactions.map(t => t.hash);
  }

  private async getOnChainTransactions(walletId: string, chain: string): Promise<string[]> {
    // Implement on-chain transaction fetching
    return [];
  }

  private findMissingTransactions(dbTxs: string[], onChainTxs: string[]): string[] {
    const dbSet = new Set(dbTxs);
    return onChainTxs.filter(tx => !dbSet.has(tx));
  }

  private findExtraTransactions(dbTxs: string[], onChainTxs: string[]): string[] {
    const onChainSet = new Set(onChainTxs);
    return dbTxs.filter(tx => !onChainSet.has(tx));
  }

  /**
   * Run reconciliation on all wallets - BATCH
   */
  async runReconciliation(limit: number = 100): Promise<{
    total: number;
    matched: number;
    failed: number;
    results: any[];
  }> {
    const wallets = await prisma.wallet.findMany({
      where: { isDeleted: false },
      take: limit,
    });

    const results = [];
    let matched = 0;
    let failed = 0;

    for (const wallet of wallets) {
      const result = await this.reconcileWallet(wallet.id, wallet.chain);
      results.push({
        walletId: wallet.id,
        address: wallet.address,
        chain: wallet.chain,
        ...result,
      });
      
      if (result.matched) matched++;
      else failed++;
    }

    return { total: wallets.length, matched, failed, results };
  }
}