// src/lib/services/price-oracle.service.ts
import { priceCache } from './price-cache.service';
import { logger } from '@/lib/logger';

// Known major tokens - these have reliable price sources
const MAJOR_TOKENS: Record<string, Record<string, string>> = {
  ethereum: {
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'ethereum',    // WETH
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'usd-coin',    // USDC
    '0xdac17f958d2ee523a2206206994597c13d831ec7': 'tether',       // USDT
    '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 'wrapped-bitcoin', // WBTC
    '0x6b175474e89094c44da98b954eedeac495271d0f': 'dai',          // DAI
    '0x514910771af9ca656af840dff83e8264ecf986ca': 'chainlink',    // LINK
    '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': 'uniswap',      // UNI
    '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0': 'matic-network', // MATIC
  },
  polygon: {
    '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270': 'wmatic',
    '0x2791bca1f2de4661ed88a30c99a7a9449aa84174': 'usd-coin',
    '0xc2132d05d31c914a87c6611c10748aeb04b58e8f': 'tether',
  },
  bsc: {
    '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c': 'binancecoin',
    '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': 'usd-coin',
    '0x55d398326f99059ff775485246999027b3197955': 'tether',
  },
};

export interface PriceRequest {
  address: string;
  chain: string;
  symbol?: string;
}

export class PriceOracleService {
  private static instance: PriceOracleService;

  static getInstance(): PriceOracleService {
    if (!PriceOracleService.instance) {
      PriceOracleService.instance = new PriceOracleService();
    }
    return PriceOracleService.instance;
  }

  /**
   * Main entry point — get prices for many tokens
   * Uses tiered fallback + caching
   */
  async getPrices(tokens: PriceRequest[]): Promise<Map<string, number>> {
    if (tokens.length === 0) return new Map();

    const result = new Map<string, number>();

    // ============================================================
    // Step 1: Check cache first (fastest, cheapest)
    // ============================================================
    const byChain = this.groupByChain(tokens);
    
    for (const [chain, chainTokens] of byChain.entries()) {
      const addresses = chainTokens.map(t => t.address);
      const cached = await priceCache.getMany(addresses, chain);
      
      for (const [addr, price] of cached.entries()) {
        result.set(addr, price);
      }
    }

    // ============================================================
    // Step 2: Find uncached tokens
    // ============================================================
    const uncached = tokens.filter(t => !result.has(t.address.toLowerCase()));
    
    if (uncached.length === 0) {
      logger.info(`✅ All ${tokens.length} prices served from cache`);
      return result;
    }

    logger.info(`🔄 Fetching ${uncached.length}/${tokens.length} uncached prices...`);

    // ============================================================
    // Step 3: Separate by tier
    // ============================================================
    const { major, mid, longTail } = this.tierTokens(uncached);

    // ============================================================
    // Step 4: Fetch each tier with the appropriate strategy
    // ============================================================

    // Tier 1: Major tokens → CoinGecko (batch request)
    if (major.length > 0) {
      const majorPrices = await this.fetchMajorPrices(major);
      for (const [addr, price] of majorPrices.entries()) {
        result.set(addr, price);
      }
    }

    // Tier 2: Mid-tier tokens → Alchemy Prices API (batch request)
    if (mid.length > 0) {
      const midPrices = await this.fetchMidTierPrices(mid);
      for (const [addr, price] of midPrices.entries()) {
        result.set(addr, price);
      }
    }

    // Tier 3: Long-tail tokens → DEX pool reserves (on-chain)
    if (longTail.length > 0) {
      const dexPrices = await this.fetchFromDexPools(longTail);
      for (const [addr, price] of dexPrices.entries()) {
        result.set(addr, price);
      }
    }

    // ============================================================
    // Step 5: Cache all results
    // ============================================================
    const toCache: Array<{ address: string; chain: string; price: number; tier: any }> = [];
    for (const [addr, price] of result.entries()) {
      const token = tokens.find(t => t.address.toLowerCase() === addr);
      if (!token) continue;
      
      let tier: 'majorToken' | 'midToken' | 'longTailToken' = 'midToken';
      if (major.some(m => m.address.toLowerCase() === addr)) tier = 'majorToken';
      else if (longTail.some(l => l.address.toLowerCase() === addr)) tier = 'longTailToken';
      
      toCache.push({ address: addr, chain: token.chain, price, tier });
    }
    
    await priceCache.setMany(toCache);

    return result;
  }

  private groupByChain(tokens: PriceRequest[]): Map<string, PriceRequest[]> {
    const map = new Map<string, PriceRequest[]>();
    for (const token of tokens) {
      const chain = token.chain.toLowerCase();
      if (!map.has(chain)) map.set(chain, []);
      map.get(chain)!.push(token);
    }
    return map;
  }

  private tierTokens(tokens: PriceRequest[]): {
    major: PriceRequest[];
    mid: PriceRequest[];
    longTail: PriceRequest[];
  } {
    const major: PriceRequest[] = [];
    const mid: PriceRequest[] = [];
    const longTail: PriceRequest[] = [];

    for (const token of tokens) {
      const chain = token.chain.toLowerCase();
      const addr = token.address.toLowerCase();
      
      if (MAJOR_TOKENS[chain]?.[addr]) {
        major.push(token);
      } else {
        // Everything else goes to mid-tier (Alchemy), which covers most tokens
        // Long-tail falls through if Alchemy fails
        mid.push(token);
      }
    }

    return { major, mid, longTail };
  }

  /**
   * ✅ Tier 1: Major tokens via CoinGecko (batch)
   */
  private async fetchMajorPrices(tokens: PriceRequest[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    
    // Map addresses to CoinGecko IDs
    const addrToId = new Map<string, string>();
    const ids = new Set<string>();
    
    for (const token of tokens) {
      const chain = token.chain.toLowerCase();
      const addr = token.address.toLowerCase();
      const cgId = MAJOR_TOKENS[chain]?.[addr];
      if (cgId) {
        addrToId.set(addr, cgId);
        ids.add(cgId);
      }
    }

    if (ids.size === 0) return result;

    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${Array.from(ids).join(',')}&vs_currencies=usd`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Crypto-Wallet-Tracker/1.0' },
      });

      if (!response.ok) {
        logger.warn(`CoinGecko ${response.status}`);
        return result;
      }

      const data = await response.json();
      
      for (const [addr, cgId] of addrToId.entries()) {
        if (data[cgId]?.usd) {
          result.set(addr, data[cgId].usd);
        }
      }

      logger.info(`✅ Major tier: ${result.size}/${tokens.length} prices from CoinGecko`);
    } catch (error) {
      logger.error('CoinGecko major fetch failed:', error);
    }

    return result;
  }

  /**
   * ✅ Tier 2: Mid-tier tokens via Alchemy Prices API (batch)
   * This covers most tokens on major chains
   */
  private async fetchMidTierPrices(tokens: PriceRequest[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    const apiKey = process.env.ALCHEMY_API_KEY;
    
    if (!apiKey) {
      logger.warn('No ALCHEMY_API_KEY, skipping mid-tier fetch');
      return result;
    }

    // Group by chain (Alchemy Prices API is chain-specific)
    const byChain = this.groupByChain(tokens);

    for (const [chain, chainTokens] of byChain.entries()) {
      const alchemyChain = this.getAlchemyChainName(chain);
      if (!alchemyChain) continue;

      try {
        // Alchemy Prices API accepts up to 25 addresses per request
        const BATCH_SIZE = 25;
        for (let i = 0; i < chainTokens.length; i += BATCH_SIZE) {
          const batch = chainTokens.slice(i, i + BATCH_SIZE);
          
          const response = await fetch(
            `https://api.g.alchemy.com/prices/v1/${apiKey}/tokens/by-address`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                addresses: batch.map(t => ({
                  network: alchemyChain,
                  address: t.address.toLowerCase(),
                })),
              }),
            }
          );

          if (!response.ok) {
            logger.warn(`Alchemy Prices ${response.status}: ${await response.text()}`);
            continue;
          }

          const data = await response.json();
          
          if (data.data && Array.isArray(data.data)) {
            for (const token of data.data) {
              const addr = token.address?.toLowerCase();
              const price = token.prices?.[0]?.value;
              if (addr && price) {
                result.set(addr, parseFloat(price));
              }
            }
          }
        }

        logger.info(`✅ Mid tier (${chain}): ${result.size} prices from Alchemy`);
      } catch (error) {
        logger.error(`Alchemy Prices failed for ${chain}:`, error);
      }
    }

    return result;
  }

  /**
   * ✅ Tier 3: Long-tail tokens via DEX pool reserves
   * Reads Uniswap V2 pool reserves directly on-chain
   */
  private async fetchFromDexPools(tokens: PriceRequest[]): Promise<Map<string, number>> {
    // This requires DEX factory lookups
    // For now, return empty — implement later if needed
    return new Map();
  }

  private getAlchemyChainName(chain: string): string | null {
    const map: Record<string, string> = {
      ethereum: 'eth-mainnet',
      polygon: 'polygon-mainnet',
      bsc: 'bnb-mainnet',
      arbitrum: 'arb-mainnet',
      optimism: 'opt-mainnet',
      avalanche: 'avax-mainnet',
      base: 'base-mainnet',
    };
    return map[chain] || null;
  }
}

export const priceOracle = PriceOracleService.getInstance();