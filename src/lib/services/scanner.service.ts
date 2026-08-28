// src/lib/services/scanner.service.ts
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

export interface ScannerFilters {
  chain?: string;
  minPnL?: number;
  maxPnL?: number;
  minWinRate?: number;
  minTrades?: number;
  minPerformance?: number;
  maxDrawdown?: number;
  minWalletScore?: number;
  preferredTokens?: string[];
  preferredProtocols?: string[];
}

export interface ScannerResult {
  address: string;
  chain: string;
  pnl: number;
  roi: number;
  winRate: number;
  tradeCount: number;
  averageTrade: number;
  volume: number;
  drawdown: number;
  walletScore: number;
  chains: string[];
  preferredTokens: string[];
  preferredProtocols: string[];
  matchedFilters: string[];
}

export class ScannerService {
  private static instance: ScannerService;

  static getInstance(): ScannerService {
    if (!ScannerService.instance) {
      ScannerService.instance = new ScannerService();
    }
    return ScannerService.instance;
  }

  /**
   * ✅ Scan wallets with advanced filters
   */
  async scanWallets(filters: ScannerFilters): Promise<ScannerResult[]> {
    try {
      // Build where clause for Prisma
      const where: any = {
        isDeleted: false,
        metrics: {
          some: {},
        },
      };

      // Chain filter
      if (filters.chain) {
        where.chain = filters.chain.toUpperCase();
      }

      // Build metric filters
      const metricFilters: any = {};

      if (filters.minPnL !== undefined) {
        metricFilters.totalPnl = { gte: filters.minPnL };
      }
      if (filters.maxPnL !== undefined) {
        metricFilters.totalPnl = { ...metricFilters.totalPnl, lte: filters.maxPnL };
      }
      if (filters.minWinRate !== undefined) {
        metricFilters.winRate = { gte: filters.minWinRate };
      }
      if (filters.minTrades !== undefined) {
        metricFilters.tradeCount = { gte: filters.minTrades };
      }
      if (filters.minPerformance !== undefined) {
        metricFilters.performance90d = { gte: filters.minPerformance };
      }
      if (filters.maxDrawdown !== undefined) {
        metricFilters.maxDrawdown = { lte: filters.maxDrawdown };
      }
      if (filters.minWalletScore !== undefined) {
        metricFilters.walletScore = { gte: filters.minWalletScore };
      }

      // Apply metric filters
      if (Object.keys(metricFilters).length > 0) {
        where.metrics = {
          some: metricFilters,
        };
      }

      // Fetch wallets with latest metrics
      const wallets = await prisma.wallet.findMany({
        where,
        include: {
          metrics: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
          transactions: {
            orderBy: { timestamp: 'desc' },
            take: 100,
          },
        },
        take: 200, // Fetch more to filter further
      });

      // Transform and filter results
      const results: ScannerResult[] = [];

      for (const wallet of wallets) {
        const metric = wallet.metrics[0];
        if (!metric) continue;

        // Calculate additional metrics
        const tradeCount = metric.tradeCount || 0;
        const totalPnL = metric.totalPnl || 0;
        const totalRoi = metric.totalRoi || 0;
        const winRate = metric.winRate || 0;

        // Skip if doesn't meet criteria
        if (filters.minPnL && totalPnL < filters.minPnL) continue;
        if (filters.maxPnL && totalPnL > filters.maxPnL) continue;
        if (filters.minWinRate && winRate < filters.minWinRate) continue;
        if (filters.minTrades && tradeCount < filters.minTrades) continue;
        if (filters.minPerformance && (metric.performance90d || 0) < filters.minPerformance) continue;
        if (filters.maxDrawdown && (metric.maxDrawdown || 0) > filters.maxDrawdown) continue;
        if (filters.minWalletScore && (metric.walletScore || 0) < filters.minWalletScore) continue;

        // Check preferred tokens
        const matchedFilters: string[] = [];
        const preferredTokens = metric.preferredTokens || [];
        const preferredProtocols = metric.preferredProtocols || [];

        if (filters.preferredTokens?.length) {
          const matches = preferredTokens.filter(t => 
            filters.preferredTokens!.includes(t)
          );
          if (matches.length > 0) {
            matchedFilters.push(`Tokens: ${matches.join(', ')}`);
          }
        }

        if (filters.preferredProtocols?.length) {
          const matches = preferredProtocols.filter(p => 
            filters.preferredProtocols!.includes(p)
          );
          if (matches.length > 0) {
            matchedFilters.push(`Protocols: ${matches.join(', ')}`);
          }
        }

        results.push({
          address: wallet.address,
          chain: wallet.chain,
          pnl: totalPnL,
          roi: totalRoi,
          winRate: winRate,
          tradeCount: tradeCount,
          averageTrade: metric.averageTrade || 0,
          volume: metric.totalVolume || 0,
          drawdown: metric.maxDrawdown || 0,
          walletScore: metric.walletScore || 0,
          chains: [wallet.chain],
          preferredTokens: preferredTokens.slice(0, 5),
          preferredProtocols: preferredProtocols.slice(0, 5),
          matchedFilters: matchedFilters,
        });
      }

      // Sort by wallet score
      results.sort((a, b) => b.walletScore - a.walletScore);

      logger.info(`Scanner found ${results.length} wallets matching criteria`);

      return results;
    } catch (error) {
      logger.error('Scanner error:', error);
      return [];
    }
  }

  /**
   * ✅ Save scanner criteria for reuse
   */
  async saveCriteria(
    userId: string,
    name: string,
    filters: ScannerFilters,
    isPublic: boolean = false
  ) {
    return prisma.scannerCriteria.create({
      data: {
        name,
        chain: filters.chain as any,
        minPnL: filters.minPnL,
        maxPnL: filters.maxPnL,
        minWinRate: filters.minWinRate,
        minTrades: filters.minTrades,
        minPerformance: filters.minPerformance,
        maxDrawdown: filters.maxDrawdown,
        minWalletScore: filters.minWalletScore,
        preferredTokens: filters.preferredTokens || [],
        preferredProtocols: filters.preferredProtocols || [],
        userId,
        isPublic,
      },
    });
  }

  /**
   * ✅ Get saved scanner criteria
   */
  async getSavedCriteria(userId: string) {
    return prisma.scannerCriteria.findMany({
      where: {
        OR: [
          { userId },
          { isPublic: true },
        ],
        isActive: true,
      },
      orderBy: { usageCount: 'desc' },
    });
  }
}

export const scannerService = ScannerService.getInstance();