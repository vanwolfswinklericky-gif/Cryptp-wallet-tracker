// src/api/services/wallet.service.ts

import { WalletData, Transaction, Token, NFT } from '../types';
import { getNativeBalance, getTransactions, getTokenBalances } from '@/lib/etherscan';
import { getNFTsForWallet } from '@/lib/nft';
import { cache } from '@/lib/cache';

export class WalletService {
  private static instance: WalletService;
  private cacheTTL = 60; // 60 seconds

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
    // ✅ Check cache first
    const cacheKey = `wallet:${chain}:${address}:${includeTxs}:${includeTokens}:${includeNFTs}`;
    const cached = cache.get<WalletData>(cacheKey);
    
    if (cached) {
      console.log(`✅ Cache hit for ${address}`);
      return cached;
    }

    console.log(`🔍 Fetching wallet data for ${address} on ${chain}...`);

    try {
      // ✅ Fetch data in parallel
      const [balanceData, transactionsData, tokensData, nftsData] = await Promise.all([
        this.getBalance(address, chain),
        includeTxs ? this.getTransactions(address, chain) : [],
        includeTokens ? this.getTokens(address, chain) : [],
        includeNFTs ? this.getNFTs(address, chain) : [],
      ]);

      const walletData: WalletData = {
        address,
        chain,
        balance: balanceData.balance,
        balanceFormatted: balanceData.formatted,
        symbol: balanceData.symbol,
        transactions: transactionsData || [],
        transactionsCount: transactionsData?.length || 0,
        tokens: tokensData || [],
        nfts: nftsData || [],
      };

      // ✅ Cache the result
      cache.set(cacheKey, walletData, this.cacheTTL);

      return walletData;

    } catch (error) {
      console.error(`❌ Error fetching wallet data for ${address}:`, error);
      throw error;
    }
  }

  private async getBalance(address: string, chain: string): Promise<{
    balance: number;
    formatted: string;
    symbol: string;
  }> {
    try {
      const response = await getNativeBalance(address, chain as any);
      
      if (response.status !== '1') {
        throw new Error(response.message || 'Failed to fetch balance');
      }

      const balanceInWei = response.result;
      const balance = parseFloat(balanceInWei) / 1e18;

      const symbols: Record<string, string> = {
        ethereum: 'ETH',
        polygon: 'MATIC',
        bsc: 'BNB',
        arbitrum: 'ETH',
        optimism: 'ETH',
        avalanche: 'AVAX',
        base: 'ETH',
        solana: 'SOL',
        bitcoin: 'BTC',
      };

      return {
        balance,
        formatted: balance.toFixed(6),
        symbol: symbols[chain] || 'ETH',
      };
    } catch (error) {
      console.error('Balance fetch error:', error);
      return {
        balance: 0,
        formatted: '0.000000',
        symbol: 'ETH',
      };
    }
  }

  private async getTransactions(address: string, chain: string): Promise<Transaction[]> {
    try {
      const response = await getTransactions(address, 1, 50, chain as any);
      
      if (response.status !== '1') {
        return [];
      }

      return response.result.slice(0, 50).map((tx: any) => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: tx.value,
        valueFormatted: (parseFloat(tx.value) / 1e18).toFixed(6),
        timeStamp: tx.timeStamp,
        date: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
        status: tx.txreceipt_status === '1' ? 'success' : 'failed',
        gasUsed: tx.gasUsed,
        gasPrice: tx.gasPrice,
      }));
    } catch (error) {
      console.error('Transactions fetch error:', error);
      return [];
    }
  }

  private async getTokens(address: string, chain: string): Promise<Token[]> {
    try {
      const response = await getTokenBalances(address, chain as any);
      
      if (response.status !== '1' || !response.result) {
        return [];
      }

      return response.result.slice(0, 50).map((token: any) => ({
        contractAddress: token.contractAddress,
        tokenName: token.tokenName || 'Unknown',
        tokenSymbol: token.tokenSymbol || 'UNKNOWN',
        decimals: token.tokenDecimal || 18,
        balance: token.balance,
        balanceFormatted: (parseFloat(token.balance) / Math.pow(10, token.tokenDecimal || 18)).toFixed(6),
        price: 0,
        value: 0,
      }));
    } catch (error) {
      console.error('Tokens fetch error:', error);
      return [];
    }
  }

  private async getNFTs(address: string, chain: string): Promise<NFT[]> {
    try {
      return await getNFTsForWallet(address, chain);
    } catch (error) {
      console.error('NFTs fetch error:', error);
      return [];
    }
  }
}