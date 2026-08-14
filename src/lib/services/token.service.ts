// src/lib/services/token.service.ts
import { cache, getTokenCacheKey } from '@/lib/cache';
import { getTokenBalances } from '@/lib/etherscan';
import { PriceService } from './price.service';

export interface TokenInfo {
  contractAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  balanceFormatted: number;
  price: number;
  value: number;
  change24h?: number;
  logo?: string;
}

export class TokenService {
  private static instance: TokenService;
  private priceService = PriceService.getInstance();

  private constructor() {}

  static getInstance(): TokenService {
    if (!TokenService.instance) {
      TokenService.instance = new TokenService();
    }
    return TokenService.instance;
  }

  async getAllTokensWithPrices(
    address: string,
    chain: string
  ): Promise<TokenInfo[]> {
    const cacheKey = getTokenCacheKey(address, chain);
    const cached = cache.get<TokenInfo[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const response = await getTokenBalances(address, chain as any);
    const tokens = response.status === '1' ? response.result : [];

    if (tokens.length === 0) {
      return [];
    }

    const symbols = tokens.map((t: any) => t.tokenSymbol);
    const prices = await this.priceService.getPrices(symbols);

    const tokenInfo: TokenInfo[] = tokens.map((token: any) => {
      const balance = parseFloat(token.balance);
      const decimals = parseInt(token.tokenDecimal) || 18;
      const balanceFormatted = balance / Math.pow(10, decimals);
      const price = prices[token.tokenSymbol] || 0;

      return {
        contractAddress: token.contractAddress,
        symbol: token.tokenSymbol || 'UNKNOWN',
        name: token.tokenName || 'Unknown Token',
        decimals,
        balance: token.balance,
        balanceFormatted,
        price,
        value: price * balanceFormatted,
        logo: this.getTokenLogo(chain, token.contractAddress),
      };
    });

    const filtered = tokenInfo
      .filter(t => t.balanceFormatted > 0)
      .sort((a, b) => b.value - a.value);

    cache.set(cacheKey, filtered, 60);
    return filtered;
  }

  async getTokenInfo(
    address: string,
    chain: string,
    contractAddress: string
  ): Promise<TokenInfo | null> {
    const allTokens = await this.getAllTokensWithPrices(address, chain);
    return allTokens.find(t => t.contractAddress.toLowerCase() === contractAddress.toLowerCase()) || null;
  }

  private getTokenLogo(chain: string, contractAddress: string): string {
    const chainMap: Record<string, string> = {
      ethereum: 'ethereum',
      polygon: 'polygon',
      bsc: 'binance',
      arbitrum: 'arbitrum',
      optimism: 'optimism',
      avalanche: 'avalanchec',
      base: 'base',
    };

    const chainName = chainMap[chain] || 'ethereum';
    return `https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/${chainName}/assets/${contractAddress}/logo.png`;
  }
}