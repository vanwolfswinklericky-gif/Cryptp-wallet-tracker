// lib/services/portfolio.service.ts
import { cache, getWalletCacheKey } from '@/lib/cache';
import { WalletService } from './wallet.service';
import { PriceService } from './price.service';

export interface PortfolioHistoryPoint {
  date: string;
  value: number;
  change: number;
  changePercentage: number;
}

export interface PortfolioHistory {
  points: PortfolioHistoryPoint[];
  startValue: number;
  endValue: number;
  totalChange: number;
  totalChangePercentage: number;
}

export class PortfolioService {
  private static instance: PortfolioService;
  private walletService = WalletService.getInstance();
  private priceService = PriceService.getInstance();

  private constructor() {}

  static getInstance(): PortfolioService {
    if (!PortfolioService.instance) {
      PortfolioService.instance = new PortfolioService();
    }
    return PortfolioService.instance;
  }

  async getPortfolioHistory(
    address: string,
    chain: string,
    days: number = 30,
    interval: 'hourly' | 'daily' | 'weekly' = 'daily'
  ): Promise<PortfolioHistoryPoint[]> {
    const cacheKey = `portfolio:history:${address}:${chain}:${days}:${interval}`;
    const cached = cache.get<PortfolioHistoryPoint[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    // Get wallet data with transactions
    const walletData = await this.walletService.getWalletData(
      address,
      chain,
      true, // include transactions
      true, // include tokens
      false // exclude NFTs for performance
    );

    // Build transaction-based history
    const history = this.buildHistoryFromTransactions(
      walletData.transactions,
      walletData.balance,
      walletData.tokens,
      days,
      interval
    );

    // Cache for 5 minutes
    cache.set(cacheKey, history, 300);

    return history;
  }

  async getCurrentPortfolioValue(
    address: string,
    chain: string
  ): Promise<number> {
    const walletData = await this.walletService.getWalletData(
      address,
      chain,
      false,
      true,
      false
    );

    // Calculate token values
    let tokenValue = 0;
    if (walletData.tokens.length > 0) {
      const symbols = walletData.tokens.map(t => t.tokenSymbol);
      const prices = await this.priceService.getPrices(symbols);
      
      tokenValue = walletData.tokens.reduce((sum, token) => {
        const price = prices[token.tokenSymbol] || 0;
        const balance = parseFloat(token.balance) / Math.pow(10, token.decimals);
        return sum + (price * balance);
      }, 0);
    }

    return walletData.balance + tokenValue;
  }

  private buildHistoryFromTransactions(
    transactions: any[],
    currentBalance: number,
    tokens: any[],
    days: number,
    interval: string
  ): PortfolioHistoryPoint[] {
    const points: PortfolioHistoryPoint[] = [];
    const now = Date.now();
    const intervalMs = this.getIntervalMs(interval);

    // Group transactions by interval
    const groupedTransactions = this.groupTransactionsByInterval(
      transactions,
      days,
      intervalMs
    );

    let runningBalance = currentBalance;

    // Build points from most recent to oldest
    for (let i = days; i >= 0; i--) {
      const date = new Date(now - i * intervalMs);
      const dateKey = date.toISOString().split('T')[0];
      
      // Get transactions for this interval
      const intervalTxs = groupedTransactions[dateKey] || [];
      
      // Calculate balance at this point
      let intervalChange = 0;
      intervalTxs.forEach(tx => {
        const value = parseFloat(tx.value) / 1e18;
        const isIncoming = tx.to?.toLowerCase() === tx.from?.toLowerCase() 
          ? false 
          : tx.to?.toLowerCase() === '0x...'; // Simplified
        intervalChange += isIncoming ? value : -value;
      });

      runningBalance -= intervalChange;

      points.push({
        date: date.toISOString(),
        value: Math.max(0, runningBalance),
        change: 0,
        changePercentage: 0,
      });
    }

    // Calculate changes
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

  private getIntervalMs(interval: string): number {
    switch (interval) {
      case 'hourly': return 3600000;
      case 'daily': return 86400000;
      case 'weekly': return 604800000;
      default: return 86400000;
    }
  }

  private groupTransactionsByInterval(
    transactions: any[],
    days: number,
    intervalMs: number
  ): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};
    const now = Date.now();

    transactions.forEach(tx => {
      const txDate = new Date(parseInt(tx.timeStamp) * 1000);
      const diff = now - txDate.getTime();
      
      if (diff <= days * 86400000) {
        const intervalKey = Math.floor(diff / intervalMs).toString();
        if (!grouped[intervalKey]) {
          grouped[intervalKey] = [];
        }
        grouped[intervalKey].push(tx);
      }
    });

    return grouped;
  }
}