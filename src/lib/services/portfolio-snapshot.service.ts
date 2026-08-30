// src/lib/services/portfolio-snapshot.service.ts
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

export interface PortfolioSnapshot {
  walletId: string;
  timestamp: Date;
  totalValue: number;
  holdings: {
    tokenAddress: string;
    tokenSymbol: string;
    balance: number;
    valueUsd: number;
    percentage: number;
  }[];
  metadata: Record<string, any>;
}

export class PortfolioSnapshotService {
  private static instance: PortfolioSnapshotService;

  static getInstance(): PortfolioSnapshotService {
    if (!PortfolioSnapshotService.instance) {
      PortfolioSnapshotService.instance = new PortfolioSnapshotService();
    }
    return PortfolioSnapshotService.instance;
  }

  async captureSnapshot(
    walletId: string,
    chain: string,
    timestamp: Date
  ): Promise<PortfolioSnapshot> {
    try {
      // Get all token balances for wallet
      const balances = await this.getWalletBalances(walletId, chain);
      
      // Calculate total value
      let totalValue = 0;
      const holdings = [];
      
      for (const balance of balances) {
        const valueUsd = balance.balance * (balance.price || 0);
        totalValue += valueUsd;
        holdings.push({
          tokenAddress: balance.tokenAddress,
          tokenSymbol: balance.tokenSymbol,
          balance: balance.balance,
          valueUsd,
          percentage: 0, // Calculated after total known
        });
      }
      
      // Calculate percentages
      for (const holding of holdings) {
        holding.percentage = totalValue > 0 ? (holding.valueUsd / totalValue) * 100 : 0;
      }

      const snapshot: PortfolioSnapshot = {
        walletId,
        timestamp,
        totalValue,
        holdings,
        metadata: {
          chain,
          tokenCount: holdings.length,
          capturedAt: new Date().toISOString(),
        },
      };

      // Store snapshot
      await this.storeSnapshot(snapshot);

      return snapshot;
    } catch (error) {
      logger.error(`Failed to capture portfolio snapshot for ${walletId}:`, error);
      throw error;
    }
  }

  async getSnapshotBeforeTransaction(
    walletId: string,
    transactionTimestamp: Date
  ): Promise<PortfolioSnapshot | null> {
    try {
      const snapshot = await prisma.portfolioSnapshot.findFirst({
        where: {
          walletId,
          timestamp: {
            lt: transactionTimestamp,
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
      });

      if (!snapshot) return null;

      return {
        walletId: snapshot.walletId,
        timestamp: snapshot.timestamp,
        totalValue: snapshot.totalValueUsd,
        holdings: snapshot.allocation,
        metadata: snapshot.metadata,
      };
    } catch (error) {
      logger.error('Failed to get snapshot before transaction:', error);
      return null;
    }
  }

  private async getWalletBalances(walletId: string, chain: string) {
    // Implement wallet balance fetching
    return [
      { tokenAddress: '0x...', tokenSymbol: 'ETH', balance: 5, price: 3500 },
      { tokenAddress: '0x...', tokenSymbol: 'USDC', balance: 10000, price: 1 },
    ];
  }

  private async storeSnapshot(snapshot: PortfolioSnapshot) {
    await prisma.portfolioSnapshot.create({
      data: {
        walletId: snapshot.walletId,
        timestamp: snapshot.timestamp,
        totalValueUsd: snapshot.totalValue,
        allocation: snapshot.holdings,
        metadata: snapshot.metadata,
      },
    });
  }
}