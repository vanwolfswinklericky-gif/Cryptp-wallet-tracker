// src/lib/services/chain.service.ts
import { cache } from '@/lib/cache';

export interface ChainActivity {
  chain: string;
  symbol: string;
  balance: number;
  balanceFormatted: string;
  transactionCount: number;
  lastTransaction: string;
  gasSpent: number;
  averageTransactionValue: number;
  activeDays: number;
  tokensCount: number;
  nftsCount: number;
  uniqueContracts: number;
}

export class ChainService {
  private static instance: ChainService;

  private constructor() {}

  static getInstance(): ChainService {
    if (!ChainService.instance) {
      ChainService.instance = new ChainService();
    }
    return ChainService.instance;
  }

  async getChainActivity(
    address: string,
    chain: string
  ): Promise<ChainActivity> {
    const cacheKey = `chain:activity:${address}:${chain}`;
    const cached = cache.get<ChainActivity>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const activity: ChainActivity = {
      chain,
      symbol: 'ETH',
      balance: 0.5,
      balanceFormatted: '0.500000',
      transactionCount: 42,
      lastTransaction: new Date().toISOString(),
      gasSpent: 0.05,
      averageTransactionValue: 0.012,
      activeDays: 15,
      tokensCount: 8,
      nftsCount: 3,
      uniqueContracts: 6,
    };

    cache.set(cacheKey, activity, 300);
    return activity;
  }
}