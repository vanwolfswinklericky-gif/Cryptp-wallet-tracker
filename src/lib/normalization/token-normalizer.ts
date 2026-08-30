// src/lib/normalization/token-normalizer.ts
import { logger } from '@/lib/logger';

export interface NormalizedToken {
  address: string;
  chain: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  isVerified: boolean;
  coingeckoId?: string;
}

export interface NormalizedTokenPrice {
  tokenAddress: string;
  chain: string;
  priceUsd: number;
  timestamp: Date;
  source: string;
  confidence: number;
}

export class TokenNormalizer {
  private static instance: TokenNormalizer;

  static getInstance(): TokenNormalizer {
    if (!TokenNormalizer.instance) {
      TokenNormalizer.instance = new TokenNormalizer();
    }
    return TokenNormalizer.instance;
  }

  /**
   * Normalize token from Alchemy
   */
  normalizeAlchemyToken(token: any, chain: string): NormalizedToken {
    return {
      address: token.contractAddress || token.address,
      chain: chain.toUpperCase(),
      symbol: token.symbol || 'Unknown',
      name: token.name || 'Unknown Token',
      decimals: token.decimals || 18,
      logoURI: token.logoURI || undefined,
      isVerified: token.isVerified || false,
      coingeckoId: token.coingeckoId || undefined,
    };
  }

  /**
   * Normalize token from Moralis
   */
  normalizeMoralisToken(token: any, chain: string): NormalizedToken {
    return {
      address: token.tokenAddress || token.address,
      chain: chain.toUpperCase(),
      symbol: token.symbol || 'Unknown',
      name: token.name || 'Unknown Token',
      decimals: token.decimals || 18,
      logoURI: token.logoUri || token.logoURI || undefined,
      isVerified: token.verified || false,
      coingeckoId: token.coingeckoId || undefined,
    };
  }

  /**
   * Normalize token from any provider
   */
  normalize(provider: string, token: any, chain: string): NormalizedToken {
    switch (provider.toLowerCase()) {
      case 'alchemy':
        return this.normalizeAlchemyToken(token, chain);
      case 'moralis':
        return this.normalizeMoralisToken(token, chain);
      default:
        return {
          address: token.address || token.contractAddress || '',
          chain: chain.toUpperCase(),
          symbol: token.symbol || 'Unknown',
          name: token.name || 'Unknown Token',
          decimals: token.decimals || 18,
          isVerified: false,
        };
    }
  }

  /**
   * Normalize token price
   */
  normalizePrice(
    provider: string,
    tokenAddress: string,
    chain: string,
    price: number,
    timestamp: Date
  ): NormalizedTokenPrice {
    let confidence = 80;
    let source = provider;

    // Increase confidence based on provider reputation
    if (provider === 'alchemy') confidence = 90;
    if (provider === 'defillama') confidence = 85;
    if (provider === 'moralis') confidence = 80;

    return {
      tokenAddress,
      chain: chain.toUpperCase(),
      priceUsd: price,
      timestamp,
      source,
      confidence,
    };
  }
}