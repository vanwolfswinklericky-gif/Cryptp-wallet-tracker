// src/lib/analytics/portfolio-engine.ts
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { HistoricalPricingService } from '@/lib/services/historical-pricing.service';

export interface PortfolioPosition {
  tokenAddress: string;
  tokenSymbol: string;
  chain: string;
  quantity: number;
  avgCost: number;
  currentValue: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  roi: number;
  percentageOfPortfolio: number;
}

export interface PortfolioSummary {
  positions: PortfolioPosition[];
  totalValue: number;
  totalPnL: number;
  totalRoi: number;
  tokenCount: number;
  largestPosition: PortfolioPosition | null;
  topHoldings: PortfolioPosition[];
}

export class PortfolioEngine {
  private static instance: PortfolioEngine;
  private pricing: HistoricalPricingService;

  private constructor() {
    this.pricing = HistoricalPricingService.getInstance();
  }

  static getInstance(): PortfolioEngine {
    if (!PortfolioEngine.instance) {
      PortfolioEngine.instance = new PortfolioEngine();
    }
    return PortfolioEngine.instance;
  }

  /**
   * Calculate full portfolio - ACCOUNTS FOR EVERYTHING
   */
  async calculatePortfolio(
    walletId: string,
    chain: string
  ): Promise<PortfolioSummary> {
    try {
      // Get all trades
      const trades = await prisma.trade.findMany({
        where: { walletId, chain },
        orderBy: { timestamp: 'asc' },
      });

      // Get current balances
      const balances = await this.getCurrentBalances(walletId, chain);

      // Build positions
      const positions = await this.buildPositions(trades, balances, chain);

      // Calculate totals
      const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
      const totalPnL = positions.reduce((sum, p) => sum + p.totalPnl, 0);
      
      // Calculate percentages
      for (const position of positions) {
        position.percentageOfPortfolio = totalValue > 0 
          ? (position.currentValue / totalValue) * 100 
          : 0;
      }

      // Sort by value
      const sorted = [...positions].sort((a, b) => b.currentValue - a.currentValue);

      return {
        positions: sorted,
        totalValue,
        totalPnL,
        totalRoi: totalValue > 0 ? (totalPnL / totalValue) * 100 : 0,
        tokenCount: positions.length,
        largestPosition: sorted.length > 0 ? sorted[0] : null,
        topHoldings: sorted.slice(0, 10),
      };
    } catch (error) {
      logger.error('Portfolio calculation failed:', error);
      throw error;
    }
  }

  private async buildPositions(
    trades: any[],
    balances: any[],
    chain: string
  ): Promise<PortfolioPosition[]> {
    const positions: Map<string, PortfolioPosition> = new Map();

    // Process each trade
    for (const trade of trades) {
      const tokenAddress = trade.side === 'BUY' ? trade.tokenIn : trade.tokenOut;
      const amount = trade.side === 'BUY' ? trade.amountIn : trade.amountOut;
      const value = trade.valueUsd || 0;

      if (!positions.has(tokenAddress)) {
        positions.set(tokenAddress, {
          tokenAddress,
          tokenSymbol: trade.tokenInSymbol || 'Unknown',
          chain,
          quantity: 0,
          avgCost: 0,
          currentValue: 0,
          realizedPnl: 0,
          unrealizedPnl: 0,
          totalPnl: 0,
          roi: 0,
          percentageOfPortfolio: 0,
        });
      }

      const pos = positions.get(tokenAddress)!;

      if (trade.side === 'BUY') {
        // Add to position
        const totalCost = pos.quantity * pos.avgCost + value;
        pos.quantity += amount;
        pos.avgCost = pos.quantity > 0 ? totalCost / pos.quantity : 0;
      } else {
        // Sell - realize PnL
        const realizedPnl = (value / amount - pos.avgCost) * amount;
        pos.realizedPnl += realizedPnl;
        pos.quantity -= amount;
        if (pos.quantity < 0) pos.quantity = 0;
      }
    }

    // Add current balances
    for (const balance of balances) {
      if (positions.has(balance.tokenAddress)) {
        const pos = positions.get(balance.tokenAddress)!;
        const price = await this.pricing.getVerifiedPrice(
          balance.tokenAddress,
          chain,
          new Date()
        );
        
        pos.currentValue = balance.quantity * (price?.priceUsd || 0);
        pos.unrealizedPnl = pos.currentValue - (pos.quantity * pos.avgCost);
        pos.totalPnl = pos.realizedPnl + pos.unrealizedPnl;
        pos.roi = pos.avgCost > 0 ? (pos.totalPnl / (pos.avgCost * pos.quantity)) * 100 : 0;
        
        // Update token symbol if available
        if (balance.tokenSymbol) {
          pos.tokenSymbol = balance.tokenSymbol;
        }
      }
    }

    return Array.from(positions.values());
  }

  private async getCurrentBalances(walletId: string, chain: string): Promise<any[]> {
    // Get latest token balances
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