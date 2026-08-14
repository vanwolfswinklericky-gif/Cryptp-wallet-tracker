// lib/services/transaction.service.ts
import { cache, getTransactionCacheKey } from '@/lib/cache';
import { getTransactions, getTokenTransfers } from '@/lib/etherscan';

export interface TransactionFilters {
  limit: number;
  offset: number;
  type?: 'incoming' | 'outgoing' | 'all';
  startBlock?: number;
  endBlock?: number;
}

export interface TransactionResult {
  transactions: any[];
  total: number;
  hasMore: boolean;
}

export interface TransactionStats {
  totalCount: number;
  incomingCount: number;
  outgoingCount: number;
  totalIncoming: number;
  totalOutgoing: number;
  uniqueAddresses: number;
  averageGasPrice: number;
  latestTransaction: string;
  oldestTransaction: string;
}

export class TransactionService {
  private static instance: TransactionService;

  private constructor() {}

  static getInstance(): TransactionService {
    if (!TransactionService.instance) {
      TransactionService.instance = new TransactionService();
    }
    return TransactionService.instance;
  }

  async getTransactions(
    address: string,
    chain: string,
    filters: TransactionFilters
  ): Promise<TransactionResult> {
    const cacheKey = getTransactionCacheKey(address, chain, filters.limit);
    const cached = cache.get<TransactionResult>(cacheKey);
    
    if (cached) {
      return cached;
    }

    // Fetch transactions
    const response = await getTransactions(
      address,
      Math.floor(filters.offset / filters.limit) + 1,
      filters.limit,
      chain as any
    );

    let transactions = response.status === '1' ? response.result : [];
    
    // Apply type filter
    if (filters.type && filters.type !== 'all') {
      transactions = transactions.filter((tx: any) => {
        const isIncoming = tx.to?.toLowerCase() === address.toLowerCase();
        return filters.type === 'incoming' ? isIncoming : !isIncoming;
      });
    }

    const result: TransactionResult = {
      transactions: transactions.slice(filters.offset, filters.offset + filters.limit),
      total: transactions.length,
      hasMore: transactions.length > filters.offset + filters.limit,
    };

    cache.set(cacheKey, result, 30);
    return result;
  }

  async getTransactionStats(
    address: string,
    chain: string
  ): Promise<TransactionStats> {
    const cacheKey = `tx:stats:${address}:${chain}`;
    const cached = cache.get<TransactionStats>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const response = await getTransactions(address, 1, 1000, chain as any);
    const transactions = response.status === '1' ? response.result : [];

    let incomingCount = 0;
    let outgoingCount = 0;
    let totalIncoming = 0;
    let totalOutgoing = 0;
    const addresses = new Set<string>();
    let totalGasPrice = 0;

    transactions.forEach((tx: any) => {
      const isIncoming = tx.to?.toLowerCase() === address.toLowerCase();
      const value = parseFloat(tx.value) / 1e18;

      if (isIncoming) {
        incomingCount++;
        totalIncoming += value;
      } else {
        outgoingCount++;
        totalOutgoing += value;
      }

      addresses.add(tx.from);
      addresses.add(tx.to);
      totalGasPrice += parseFloat(tx.gasPrice) / 1e9;
    });

    const stats: TransactionStats = {
      totalCount: transactions.length,
      incomingCount,
      outgoingCount,
      totalIncoming,
      totalOutgoing,
      uniqueAddresses: addresses.size,
      averageGasPrice: transactions.length > 0 ? totalGasPrice / transactions.length : 0,
      latestTransaction: transactions[0]?.timeStamp || '',
      oldestTransaction: transactions[transactions.length - 1]?.timeStamp || '',
    };

    cache.set(cacheKey, stats, 300);
    return stats;
  }
}