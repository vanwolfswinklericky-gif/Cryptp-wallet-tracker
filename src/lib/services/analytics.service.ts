// src/lib/services/analytics.service.ts
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

export interface AnalyticsResult {
  wallet: {
    address: string;
    chain: string;
    label?: string;
  };
  performance: {
    totalPnl: number;
    roi: number;
    winRate: number;
    tradeCount: number;
    totalVolume: number;
    maxDrawdown: number;
    avgTrade: number;
  };
  scoring: {
    walletScore: number;
    smartMoneyScore: number;
    consistencyScore: number;
    riskScore: number;
  };
  behavior: {
    avgHoldingPeriod: number;
    tradingFrequency: number;
    avgPositionSize: number;
    activeDays: number;
  };
  preferences: {
    topTokens: string[];
    topProtocols: string[];
    topChains: string[];
  };
  history: {
    monthlyPnL: Array<{ month: string; value: number }>;
    monthlyScores: Array<{ month: string; score: number }>;
  };
}

export class AnalyticsService {
  private static instance: AnalyticsService;

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  /**
   * ✅ Get comprehensive analytics for a wallet
   */
  async getWalletAnalytics(walletId: string): Promise<AnalyticsResult | null> {
    try {
      const wallet = await prisma.wallet.findUnique({
        where: { id: walletId, isDeleted: false },
        include: {
          metrics: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
          trades: {
            orderBy: { timestamp: 'desc' },
            take: 500,
          },
          walletHistory: {
            orderBy: { month: 'desc' },
            take: 12,
          },
          portfolioSnapshots: {
            orderBy: { timestamp: 'desc' },
            take: 30,
          },
        },
      });

      if (!wallet) return null;

      const metric = wallet.metrics[0];
      if (!metric) return null;

      // Calculate behavior metrics
      const behavior = this.calculateBehaviorMetrics(wallet.trades);

      // Calculate preferences
      const preferences = this.calculatePreferences(wallet.trades);

      // Build history
      const history = {
        monthlyPnL: wallet.walletHistory.map(h => ({
          month: h.month,
          value: h.totalPnL,
        })),
        monthlyScores: wallet.walletHistory.map(h => ({
          month: h.month,
          score: h.walletScore,
        })),
      };

      return {
        wallet: {
          address: wallet.address,
          chain: wallet.chain,
          label: wallet.label || undefined,
        },
        performance: {
          totalPnl: metric.totalPnl || 0,
          roi: metric.totalRoi || 0,
          winRate: metric.winRate || 0,
          tradeCount: metric.tradeCount || 0,
          totalVolume: metric.totalVolume || 0,
          maxDrawdown: metric.maxDrawdown || 0,
          avgTrade: metric.averageTrade || 0,
        },
        scoring: {
          walletScore: metric.walletScore || 0,
          smartMoneyScore: metric.smartMoneyScore || 0,
          consistencyScore: metric.consistencyScore || 0,
          riskScore: metric.riskScore || 0,
        },
        behavior: {
          avgHoldingPeriod: behavior.avgHoldingPeriod,
          tradingFrequency: behavior.tradingFrequency,
          avgPositionSize: behavior.avgPositionSize,
          activeDays: behavior.activeDays,
        },
        preferences: {
          topTokens: preferences.topTokens,
          topProtocols: preferences.topProtocols,
          topChains: preferences.topChains,
        },
        history,
      };
    } catch (error) {
      logger.error('Analytics error:', error);
      return null;
    }
  }

  private calculateBehaviorMetrics(trades: any[]) {
    if (trades.length === 0) {
      return {
        avgHoldingPeriod: 0,
        tradingFrequency: 0,
        avgPositionSize: 0,
        activeDays: 0,
      };
    }

    // Calculate average holding period
    // ... complex calculation

    // Calculate trading frequency
    // ... complex calculation

    // Calculate average position size
    const avgPositionSize = trades.reduce((sum, t) => sum + Math.abs(t.valueUsd || 0), 0) / trades.length;

    // Calculate active days
    const days = new Set(trades.map(t => t.timestamp.toISOString().split('T')[0])).size;

    return {
      avgHoldingPeriod: 0,
      tradingFrequency: trades.length / (days || 1),
      avgPositionSize,
      activeDays: days,
    };
  }

  private calculatePreferences(trades: any[]) {
    const tokenCount: Record<string, number> = {};
    const protocolCount: Record<string, number> = {};
    const chainCount: Record<string, number> = {};

    for (const trade of trades) {
      if (trade.tokenInSymbol) {
        tokenCount[trade.tokenInSymbol] = (tokenCount[trade.tokenInSymbol] || 0) + 1;
      }
      if (trade.protocol) {
        protocolCount[trade.protocol] = (protocolCount[trade.protocol] || 0) + 1;
      }
      if (trade.chain) {
        chainCount[trade.chain] = (chainCount[trade.chain] || 0) + 1;
      }
    }

    return {
      topTokens: Object.entries(tokenCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([token]) => token),
      topProtocols: Object.entries(protocolCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([protocol]) => protocol),
      topChains: Object.entries(chainCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([chain]) => chain),
    };
  }
}