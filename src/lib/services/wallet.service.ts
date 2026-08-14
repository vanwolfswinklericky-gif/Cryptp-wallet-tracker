// src/lib/services/wallet.service.ts
import { cache, getWalletCacheKey } from '@/lib/cache';

export interface WalletData {
  address: string;
  chain: string;
  balance: number;
  balanceFormatted: string;
  symbol: string;
  transactions: any[];
  transactionsCount: number;
  tokens: any[];
  nfts?: any[];
}

export class WalletService {
  private static instance: WalletService;

  private constructor() {}

  static getInstance(): WalletService {
    if (!WalletService.instance) {
      WalletService.instance = new WalletService();
    }
    return WalletService.instance;
  }

  async getWalletData(
    address: string,
    chain: string = 'ethereum',
    includeTxs: boolean = true,
    includeTokens: boolean = true,
    includeNFTs: boolean = true
  ): Promise<WalletData> {
    const cacheKey = getWalletCacheKey(address, chain, includeTxs);
    const cached = cache.get<WalletData>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const walletData: WalletData = {
      address,
      chain,
      balance: 1.5,
      balanceFormatted: '1.500000',
      symbol: 'ETH',
      transactions: includeTxs ? [
        {
          hash: '0x...',
          from: address,
          to: '0x...',
          value: '1000000000000000000',
          timeStamp: Math.floor(Date.now() / 1000).toString(),
        },
      ] : [],
      transactionsCount: includeTxs ? 1 : 0,
      tokens: includeTokens ? [
        {
          contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          tokenName: 'USD Coin',
          tokenSymbol: 'USDC',
          decimals: 6,
          balance: '1000000',
        },
      ] : [],
      nfts: includeNFTs ? [] : [],
    };

    cache.set(cacheKey, walletData, 60);
    return walletData;
  }
}