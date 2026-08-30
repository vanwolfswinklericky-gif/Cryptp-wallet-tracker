// src/lib/analytics/pnl-engine.ts
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { HistoricalPricingService } from '@/lib/services/historical-pricing.service';

export interface PnLResult {
  totalPnL: number;
  realizedPnL: number;
  unrealizedPnL: number;
  roi: number;
  byToken: {
    tokenAddress: string;
    tokenSymbol: string;
    realizedPnL: number;
    unrealizedPnL: number;
    totalPnL: number;
    roi: number;
  }[];
  byTimeframe: {
    daily: number;
    weekly: number;
    monthly: number;
    yearly: number;
  };
  tradeCount: number;
  winCount: number;
  lossCount: number;
  winRate: number;
}

export class PnLEngine {
  private static instance: PnLEngine;
  private pricing: HistoricalPricingService;

  private constructor() {
    this.pricing = HistoricalPricingService.getInstance();
  }

  static getInstance(): PnLEngine {
    if (!PnLEngine.instance) {
      PnLEngine.instance = new PnLEngine();
    }
    return PnLEngine.instance;
  }

  /**
   * Calculate complete PnL - ENTERPRISE GRADE
   */
  async calculatePnL(
    walletId: string,
    chain: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<PnLResult> {
    try {
      // Get all trades
      const where: any = { walletId, chain };
      if (fromDate) where.timestamp = { gte: fromDate };
      if (toDate) where.timestamp = { ...where.timestamp, lte: toDate };

      const trades = await prisma.trade.findMany({
        where,
        orderBy: { timestamp: 'asc' },
      });

      // Get current balances
      const balances = await this.getCurrentBalances(walletId, chain);

      // Calculate per-token PnL
      const tokenPnL = await this.calculateTokenPnL(trades, balances, chain);

      // Calculate totals
      const totalRealized = tokenPnL.reduce((sum, t) => sum + t.realizedPnL, 0);
      const totalUnrealized = tokenPnL.reduce((sum, t) => sum + t.unrealizedPnL, 0);
      const totalPnL = totalRealized + totalUnrealized;
      const totalRoi = this.calculateROI(tokenPnL);

      // Calculate timeframe PnL
      const timeframePnL = this.calculateTimeframePnL(trades);

      // Calculate win rate
      const wins = trades.filter(t => t.valueUsd > 0);
      const losses = trades.filter(t => t.valueUsd < 0);

      return {
        totalPnL,
        realizedPnL: totalRealized,
        unrealizedPnL: totalUnrealized,
        roi: totalRoi,
        byToken: tokenPnL,
        byTimeframe: timeframePnL,
        tradeCount: trades.length,
        winCount: wins.length,
        lossCount: losses.length,
        winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
      };
    } catch (error) {
      logger.error('PnL calculation failed:', error);
      throw error;
    }
  }

  private async calculateTokenPnL(
    trades: any[],
    balances: any[],
    chain: string
  ): Promise<{
    tokenAddress: string;
    tokenSymbol: string;
    realizedPnL: number;
    unrealizedPnL: number;
    totalPnL: number;
    roi: number;
  }[]> {
    const tokenMap: Map<string, {
      tokenAddress: string;
      tokenSymbol: string;
      quantity: number;
      avgCost: number;
      realizedPnL: number;
      totalSpent: number;
    }> = new Map();

    // Process trades
    for (const trade of trades) {
      const tokenAddress = trade.side === 'BUY' ? trade.tokenIn : trade.tokenOut;
      const amount = trade.side === 'BUY' ? trade.amountIn : trade.amountOut;
      const value = trade.valueUsd || 0;

      if (!tokenMap.has(tokenAddress)) {
        tokenMap.set(tokenAddress, {
          tokenAddress,
          tokenSymbol: trade.tokenInSymbol || 'Unknown',
          quantity: 0,
          avgCost: 0,
          realizedPnL: 0,
          totalSpent: 0,
        });
      }

      const pos = tokenMap.get(tokenAddress)!;

      if (trade.side === 'BUY') {
        pos.quantity += amount;
        pos.totalSpent += value;
        pos.avgCost = pos.quantity > 0 ? pos.totalSpent / pos.quantity : 0;
      } else {
        // Sell - realize PnL
        const realizedPnL = value - (amount * pos.avgCost);
        pos.realizedPnL += realizedPnL;
        pos.quantity -= amount;
        if (pos.quantity < 0) pos.quantity = 0;
      }
    }

    // Add current balances
    const results: {
      tokenAddress: string;
      tokenSymbol: string;
      realizedPnL: number;
      unrealizedPnL: number;
      totalPnL: number;
      roi: number;
    }[] = [];

    for (const balance of balances) {
      if (tokenMap.has(balance.tokenAddress)) {
        const pos = tokenMap.get(balance.tokenAddress)!;
        const price = await this.pricing.getVerifiedPrice(
          balance.tokenAddress,
          chain,
          new Date()
        );
        
        const currentValue = balance.quantity * (price?.priceUsd || 0);
        const unrealizedPnL = currentValue - (balance.quantity * pos.avgCost);
        const totalPnL = pos.realizedPnL + unrealizedPnL;
        const roi = pos.totalSpent > 0 ? (totalPnL / pos.totalSpent) * 100 : 0;

        results.push({
          tokenAddress: balance.tokenAddress,
          tokenSymbol: balance.tokenSymbol || pos.tokenSymbol,
          realizedPnL: pos.realizedPnL,
          unrealizedPnL,
          totalPnL,
          roi,
        });
      }
    }

    // Add any positions with no current balance
    for (const [address, pos] of tokenMap) {
      if (!results.find(r => r.tokenAddress === address)) {
        results.push({
          tokenAddress: address,
          tokenSymbol: pos.tokenSymbol,
          realizedPnL: pos.realizedPnL,
          unrealizedPnL: 0,
          totalPnL: pos.realizedPnL,
          roi: 0,
        });
      }
    }

    return results;
  }

  private calculateTimeframePnL(trades: any[]): {
    daily: number;
    weekly: number;
    monthly: number;
    yearly: number;
  } {
    const now = new Date();
    const daily = new Date(now);
    daily.setDate(daily.getDate() - 1);
    const weekly = new Date(now);
    weekly.setDate(weekly.getDate() - 7);
    const monthly = new Date(now);
    monthly.setMonth(monthly.getMonth() - 1);
    const yearly = new Date(now);
    yearly.setFullYear(yearly.getFullYear() - 1);

    const calculateSum = (cutoff: Date) => {
      return trades
        .filter(t => t.timestamp >= cutoff)
        .reduce((sum, t) => sum + (t.valueUsd || 0), 0);
    };

    return {
      daily: calculateSum(daily),
      weekly: calculateSum(weekly),
      monthly: calculateSum(monthly),
      yearly: calculateSum(yearly),
    };
  }

  private calculateROI(tokenPnL: any[]): number {
    const totalPnL = tokenPnL.reduce((sum, t) => sum + t.totalPnL, 0);
    const totalInvested = tokenPnL.reduce((sum, t) => sum + t.totalSpent, 0);
    return totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
  }

  private async getCurrentBalances(walletId: string, chain: string): Promise<any[]> {
    const transfers = await prisma.tokenTransfer.findMany({
      where: { walletId },
      orderBy: { timestamp: 'desc' },
      distinct: ['tokenAddress'],
    });

    return transfers.map(t => ({
      tokenAddress: t.tokenAddress,
      tokenSymbol: t.tokenSymbol,
      quantity: t.amount,
    }));
  }
}