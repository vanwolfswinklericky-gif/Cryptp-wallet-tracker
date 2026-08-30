// src/lib/analytics/position-engine.ts
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

export interface Position {
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
  transactions: PositionTransaction[];
}

export interface PositionTransaction {
  txHash: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  valueUsd: number;
  timestamp: Date;
}

export class PositionEngine {
  private static instance: PositionEngine;

  static getInstance(): PositionEngine {
    if (!PositionEngine.instance) {
      PositionEngine.instance = new PositionEngine();
    }
    return PositionEngine.instance;
  }

  /**
   * Calculate position for a wallet - ACCOUNTS FOR EVERYTHING
   */
  async calculatePosition(
    walletId: string,
    tokenAddress: string,
    chain: string
  ): Promise<Position | null> {
    try {
      // Get all trades for this wallet/token
      const trades = await prisma.trade.findMany({
        where: {
          walletId,
          chain,
          OR: [
            { tokenIn: tokenAddress },
            { tokenOut: tokenAddress },
          ],
        },
        orderBy: { timestamp: 'asc' },
      });

      if (trades.length === 0) return null;

      let quantity = 0;
      let totalCost = 0;
      let realizedPnl = 0;
      const transactions: PositionTransaction[] = [];

      for (const trade of trades) {
        const isBuy = trade.side === 'BUY';
        const isTokenIn = trade.tokenIn === tokenAddress;
        
        const tradeQuantity = isTokenIn ? trade.amountIn : trade.amountOut;
        const tradeValue = isTokenIn ? trade.valueUsd : trade.valueUsd;
        const tradePrice = tradeValue / tradeQuantity;

        if (isBuy) {
          // BUY - Add to position
          quantity += tradeQuantity;
          totalCost += tradeValue;
          
          transactions.push({
            txHash: trade.txHash,
            type: 'BUY',
            quantity: tradeQuantity,
            price: tradePrice,
            valueUsd: tradeValue,
            timestamp: trade.timestamp,
          });
        } else {
          // SELL - Realize PnL
          const avgCost = quantity > 0 ? totalCost / quantity : 0;
          const realized = (tradePrice - avgCost) * tradeQuantity;
          realizedPnl += realized;
          
          quantity -= tradeQuantity;
          totalCost -= avgCost * tradeQuantity;
          
          transactions.push({
            txHash: trade.txHash,
            type: 'SELL',
            quantity: tradeQuantity,
            price: tradePrice,
            valueUsd: tradeValue,
            timestamp: trade.timestamp,
          });
        }
      }

      // Calculate current value
      const currentPrice = await this.getCurrentPrice(tokenAddress, chain);
      const currentValue = quantity * currentPrice;
      const avgCost = quantity > 0 ? totalCost / quantity : 0;
      const unrealizedPnl = currentValue - totalCost;
      const totalPnl = realizedPnl + unrealizedPnl;
      const roi = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

      // Get token symbol
      const token = await prisma.token.findUnique({
        where: { chain_address: { chain, address: tokenAddress } },
      });

      return {
        tokenAddress,
        tokenSymbol: token?.symbol || 'Unknown',
        chain,
        quantity,
        avgCost: avgCost || 0,
        currentValue,
        realizedPnl,
        unrealizedPnl,
        totalPnl,
        roi,
        transactions,
      };
    } catch (error) {
      logger.error('Position calculation failed:', error);
      return null;
    }
  }

  /**
   * Calculate full wallet portfolio - ALL POSITIONS
   */
  async calculatePortfolio(walletId: string, chain: string) {
    // Get all unique tokens
    const trades = await prisma.trade.findMany({
      where: { walletId, chain },
      select: {
        tokenIn: true,
        tokenOut: true,
      },
    });

    const tokenSet = new Set<string>();
    for (const trade of trades) {
      tokenSet.add(trade.tokenIn);
      tokenSet.add(trade.tokenOut);
    }

    const positions: Position[] = [];
    let totalValue = 0;

    for (const tokenAddress of tokenSet) {
      const position = await this.calculatePosition(walletId, tokenAddress, chain);
      if (position) {
        positions.push(position);
        totalValue += position.currentValue;
      }
    }

    return {
      positions,
      totalValue,
      totalPnL: positions.reduce((sum, p) => sum + p.totalPnl, 0),
      totalRoi: positions.reduce((sum, p) => sum + p.roi, 0) / (positions.length || 1),
    };
  }

  private async getCurrentPrice(tokenAddress: string, chain: string): Promise<number> {
    // Get latest price
    const price = await prisma.tokenPrice.findFirst({
      where: {
        token: { chain, address: tokenAddress },
      },
      orderBy: { timestamp: 'desc' },
    });
    return price?.priceUsd || 0;
  }
}