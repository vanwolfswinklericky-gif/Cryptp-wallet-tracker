// src/lib/services/portfolio.service.ts
import { cache } from '@/lib/cache';
import { zerionService } from './zerion.service';
import { logger } from '@/lib/logger';

export interface PortfolioHistoryPoint {
  date: string;
  value: number;
  change: number;
  changePercentage: number;
}

export class PortfolioService {
  private static instance: PortfolioService;
  private zerionService = zerionService;

  private constructor() {}

  static getInstance(): PortfolioService {
    if (!PortfolioService.instance) {
      PortfolioService.instance = new PortfolioService();
    }
    return PortfolioService.instance;
  }

  /**
   * ✅ Get portfolio history for a wallet
   * Now uses Zerion for all data — no separate price lookups needed
   */
  async getPortfolioHistory(
    address: string,
    chain: string,
    days: number = 30,
    interval: 'hourly' | 'daily' | 'weekly' = 'daily'
  ): Promise<PortfolioHistoryPoint[]> {
    const cacheKey = `portfolio:history:${address}:${chain}:${days}:${interval}`;
    const cached = cache.get<PortfolioHistoryPoint[]>(cacheKey);

    if (cached) {
      logger.info(`📦 Portfolio history cache hit for ${address}`);
      return cached;
    }

    logger.info(`🔍 Building portfolio history for ${address} (${days} days, ${interval})`);

    // Fetch transactions from Zerion
    const transactions = await this.zerionService.getWalletTransactions(address, 100);

    // Fetch current portfolio value
    const currentValue = await this.getCurrentPortfolioValue(address, chain);

    // Build history from transactions
    const history = this.buildHistoryFromTransactions(
      transactions,
      currentValue,
      days,
      interval
    );

    cache.set(cacheKey, history, 300);
    return history;
  }

  /**
   * ✅ Get current portfolio value
   * Zerion returns prices for all tokens — no need for a separate price service
   */
  async getCurrentPortfolioValue(
    address: string,
    chain: string
  ): Promise<number> {
    try {
      const positions = await this.zerionService.getWalletPositions(address);
      
      // Zerion already includes valueUsd for each token
      const totalValue = positions.reduce((sum, pos) => {
        return sum + (pos.valueUsd || 0);
      }, 0);

      logger.info(`💰 Current portfolio value for ${address}: $${totalValue.toFixed(2)}`);
      return totalValue;
    } catch (error) {
      logger.error(`❌ Failed to get portfolio value:`, error);
      return 0;
    }
  }

  /**
   * ✅ Build history points from transactions
   * Adapted to work with Zerion's transaction format
   */
  private buildHistoryFromTransactions(
    transactions: any[],
    currentValue: number,
    days: number,
    interval: string
  ): PortfolioHistoryPoint[] {
    const points: PortfolioHistoryPoint[] = [];
    const now = Date.now();
    const intervalMs = this.getIntervalMs(interval);

    // ✅ Sort transactions by timestamp (Zerion returns `mined_at` or `timestamp`)
    const sortedTxs = [...transactions].sort((a, b) => {
      const aTime = this.getTxTimestamp(a);
      const bTime = this.getTxTimestamp(b);
      return aTime - bTime;
    });

    // Walk backward from current value
    let runningBalance = currentValue;

    for (let i = days; i >= 0; i--) {
      const date = new Date(now - i * intervalMs);
      const dateKey = date.toISOString().split('T')[0];

      // Find transactions in this interval
      const intervalTxs = sortedTxs.filter(tx => {
        const txDate = new Date(this.getTxTimestamp(tx)).toISOString().split('T')[0];
        return txDate === dateKey;
      });

      // Calculate net change in this interval
      let intervalChange = 0;
      intervalTxs.forEach(tx => {
        intervalChange += this.getTxValueUsd(tx);
      });

      // Subtract from running balance to get value at start of interval
      runningBalance -= intervalChange;

      points.push({
        date: date.toISOString(),
        value: Math.max(0, runningBalance),
        change: 0,
        changePercentage: 0,
      });
    }

    // Calculate change between consecutive points
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      curr.change = curr.value - prev.value;
      curr.changePercentage = prev.value > 0
        ? (curr.change / prev.value) * 100
        : 0;
    }

    return points.reverse();
  }

  /**
   * ✅ Extract timestamp from a Zerion transaction
   */
  private getTxTimestamp(tx: any): number {
    // Zerion uses `mined_at` (ISO string) or `timestamp`
    if (tx.mined_at) return new Date(tx.mined_at).getTime();
    if (tx.timestamp) return new Date(tx.timestamp).getTime();
    if (tx.timeStamp) return parseInt(tx.timeStamp) * 1000; // Etherscan format fallback
    return Date.now();
  }

  /**
   * ✅ Extract USD value from a Zerion transaction
   * Handles both incoming and outgoing
   */
  private getTxValueUsd(tx: any): number {
    // Zerion format
    const attrs = tx.attributes || tx;
    const value = attrs.value || 0;
    const direction = attrs.direction || 'in';

    // Positive = incoming, Negative = outgoing
    return direction === 'in' ? Math.abs(value) : -Math.abs(value);
  }

  private getIntervalMs(interval: string): number {
    switch (interval) {
      case 'hourly': return 3600000;
      case 'daily': return 86400000;
      case 'weekly': return 604800000;
      default: return 86400000;
    }
  }
}