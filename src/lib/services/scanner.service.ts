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
  minSmartMoneyScore?: number;
  preferredTokens?: string[];
  preferredProtocols?: string[];
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
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
   * ✅ Advanced wallet scanning with all criteria
   */
  async scanWallets(filters: ScannerFilters) {
    try {
      const {
        chain,
        minPnL,
        maxPnL,
        minWinRate,
        minTrades,
        minPerformance,
        maxDrawdown,
        minWalletScore,
        minSmartMoneyScore,
        preferredTokens,
        preferredProtocols,
        limit = 50,
        sortBy = 'walletScore',
        sortOrder = 'desc',
      } = filters;

      // Build where clause
      const where: any = {
        isDeleted: false,
        metrics: {
          some: {},
        },
      };

      if (chain) {
        where.chain = chain.toUpperCase();
      }

      // Build metric filters
      const metricFilters: any = {};
      if (minPnL !== undefined) metricFilters.totalPnl = { gte: minPnL };
      if (maxPnL !== undefined) metricFilters.totalPnl = { ...metricFilters.totalPnl, lte: maxPnL };
      if (minWinRate !== undefined) metricFilters.winRate = { gte: minWinRate };
      if (minTrades !== undefined) metricFilters.tradeCount = { gte: minTrades };
      if (minPerformance !== undefined) metricFilters.performance30d = { gte: minPerformance };
      if (maxDrawdown !== undefined) metricFilters.maxDrawdown = { lte: maxDrawdown };
      if (minWalletScore !== undefined) metricFilters.walletScore = { gte: minWalletScore };
      if (minSmartMoneyScore !== undefined) metricFilters.smartMoneyScore = { gte: minSmartMoneyScore };

      if (Object.keys(metricFilters).length > 0) {
        where.metrics = { some: metricFilters };
      }

      // Fetch wallets with latest metrics
      const wallets = await prisma.wallet.findMany({
        where,
        include: {
          metrics: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
          trades: {
            orderBy: { timestamp: 'desc' },
            take: 100,
          },
          walletHistory: {
            orderBy: { month: 'desc' },
            take: 6,
          },
        },
        take: limit * 2, // Fetch more to filter further
      });

      // Transform and enrich results
      const results = wallets
        .map((wallet) => {
          const metric = wallet.metrics[0];
          if (!metric) return null;

          const matchedFilters: string[] = [];
          
          // Check each filter
          if (minPnL && metric.totalPnl >= minPnL) {
            matchedFilters.push(`PnL > $${minPnL.toLocaleString()}`);
          }
          if (minWinRate && metric.winRate >= minWinRate) {
            matchedFilters.push(`Win Rate > ${minWinRate}%`);
          }
          if (minTrades && metric.tradeCount >= minTrades) {
            matchedFilters.push(`${minTrades}+ Trades`);
          }
          if (minPerformance && metric.performance30d >= minPerformance) {
            matchedFilters.push(`30d Performance > ${minPerformance}%`);
          }
          if (maxDrawdown && metric.maxDrawdown <= maxDrawdown) {
            matchedFilters.push(`Drawdown < ${maxDrawdown}%`);
          }
          if (minWalletScore && metric.walletScore >= minWalletScore) {
            matchedFilters.push(`Score > ${minWalletScore}`);
          }

          return {
            address: wallet.address,
            chain: wallet.chain,
            label: wallet.label,
            pnl: metric.totalPnl || 0,
            roi: metric.totalRoi || 0,
            winRate: metric.winRate || 0,
            tradeCount: metric.tradeCount || 0,
            averageTrade: metric.averageTrade || 0,
            volume: metric.totalVolume || 0,
            drawdown: metric.maxDrawdown || 0,
            walletScore: metric.walletScore || 0,
            smartMoneyScore: metric.smartMoneyScore || 0,
            consistencyScore: metric.consistencyScore || 0,
            performance30d: metric.performance30d || 0,
            performance90d: metric.performance90d || 0,
            preferredTokens: metric.preferredTokens || [],
            preferredProtocols: metric.preferredProtocols || [],
            matchedFilters,
            monthlyPerformance: wallet.walletHistory.map(h => ({
              month: h.month,
              pnl: h.totalPnL,
              roi: h.totalRoi,
              winRate: h.winRate,
              score: h.walletScore,
            })),
            tags: [], // Add tags from wallet.tags
          };
        })
        .filter(Boolean)
        .sort((a, b) => {
          const aVal = a[sortBy as keyof typeof a] || 0;
          const bVal = b[sortBy as keyof typeof b] || 0;
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
          }
          return 0;
        })
        .slice(0, limit);

      return {
        wallets: results,
        count: results.length,
        filters,
      };
    } catch (error) {
      logger.error('Scanner error:', error);
      throw error;
    }
  }

  /**
   * ✅ Get trending wallets
   */
  async getTrendingWallets(chain?: string, limit: number = 20) {
    const where: any = {
      isDeleted: false,
      metrics: {
        some: {
          performance7d: { gt: 0 },
        },
      },
    };

    if (chain) {
      where.chain = chain.toUpperCase();
    }

    const wallets = await prisma.wallet.findMany({
      where,
      include: {
        metrics: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
      orderBy: {
        metrics: {
          performance7d: 'desc',
        },
      },
      take: limit,
    });

    return wallets.map((wallet) => {
      const metric = wallet.metrics[0];
      return {
        address: wallet.address,
        chain: wallet.chain,
        label: wallet.label,
        performance7d: metric?.performance7d || 0,
        performance30d: metric?.performance30d || 0,
        totalPnL: metric?.totalPnl || 0,
        walletScore: metric?.walletScore || 0,
      };
    });
  }

  /**
   * ✅ Get top performers
   */
  async getTopPerformers(chain?: string, timeframe: string = '30d', limit: number = 20) {
    const fieldMap: Record<string, string> = {
      '24h': 'performance24h',
      '7d': 'performance7d',
      '30d': 'performance30d',
      '90d': 'performance90d',
    };

    const performanceField = fieldMap[timeframe] || 'performance30d';

    const where: any = {
      isDeleted: false,
      metrics: {
        some: {
          tradeCount: { gt: 10 },
        },
      },
    };

    if (chain) {
      where.chain = chain.toUpperCase();
    }

    const wallets = await prisma.wallet.findMany({
      where,
      include: {
        metrics: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
      take: limit,
    });

    return wallets
      .map((wallet) => {
        const metric = wallet.metrics[0];
        if (!metric) return null;
        const performance = (metric as any)[performanceField] || 0;
        return {
          address: wallet.address,
          chain: wallet.chain,
          performance,
          walletScore: metric.walletScore || 0,
          roi: metric.totalRoi || 0,
          winRate: metric.winRate || 0,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b?.performance || 0) - (a?.performance || 0));
  }

  /**
   * ✅ Get smart money wallets
   */
  async getSmartMoneyWallets(chain?: string, limit: number = 20) {
    const where: any = {
      isDeleted: false,
      metrics: {
        some: {
          smartMoneyScore: { gte: 80 },
          winRate: { gte: 55 },
          maxDrawdown: { lte: 20 },
          tradeCount: { gte: 20 },
        },
      },
    };

    if (chain) {
      where.chain = chain.toUpperCase();
    }

    const wallets = await prisma.wallet.findMany({
      where,
      include: {
        metrics: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
        walletHistory: {
          orderBy: { month: 'desc' },
          take: 6,
        },
      },
      take: limit,
    });

    return wallets.map((wallet) => {
      const metric = wallet.metrics[0];
      return {
        address: wallet.address,
        chain: wallet.chain,
        label: wallet.label,
        walletScore: metric?.walletScore || 0,
        smartMoneyScore: metric?.smartMoneyScore || 0,
        winRate: metric?.winRate || 0,
        drawdown: metric?.maxDrawdown || 0,
        consistency: metric?.consistencyScore || 0,
        monthlyPerformance: wallet.walletHistory.map(h => ({
          month: h.month,
          score: h.walletScore,
          pnl: h.totalPnL,
        })),
      };
    });
  }

  /**
   * ✅ Get whales (high volume traders)
   */
  async getWhales(chain?: string, minVolume: number = 100000, limit: number = 20) {
    const where: any = {
      isDeleted: false,
      metrics: {
        some: {
          totalVolume: { gte: minVolume },
          tradeCount: { gt: 50 },
        },
      },
    };

    if (chain) {
      where.chain = chain.toUpperCase();
    }

    const wallets = await prisma.wallet.findMany({
      where,
      include: {
        metrics: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
      orderBy: {
        metrics: {
          totalVolume: 'desc',
        },
      },
      take: limit,
    });

    return wallets.map((wallet) => {
      const metric = wallet.metrics[0];
      return {
        address: wallet.address,
        chain: wallet.chain,
        volume: metric?.totalVolume || 0,
        pnl: metric?.totalPnl || 0,
        tradeCount: metric?.tradeCount || 0,
        walletScore: metric?.walletScore || 0,
      };
    });
  }

  /**
   * ✅ Get early buyers of a token
   */
  async getEarlyBuyers(tokenAddress: string, chain: string, limit: number = 20) {
    const trades = await prisma.trade.findMany({
      where: {
        chain: chain.toUpperCase(),
        tokenIn: tokenAddress,
        side: 'BUY',
      },
      orderBy: { timestamp: 'asc' },
      include: {
        wallet: {
          include: {
            metrics: {
              orderBy: { timestamp: 'desc' },
              take: 1,
            },
          },
        },
      },
      take: limit,
    });

    return trades.map((trade) => ({
      address: trade.wallet.address,
      chain: trade.wallet.chain,
      buyAmount: trade.amountIn,
      buyPrice: trade.priceUsd || 0,
      buyDate: trade.timestamp,
      walletScore: trade.wallet.metrics[0]?.walletScore || 0,
    }));
  }
}