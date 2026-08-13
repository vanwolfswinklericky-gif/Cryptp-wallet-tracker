// src/lib/price-indexer/index.ts

import { TokenPrice, PriceCache } from './types';

// ============================================================
// PRICE SOURCES (Multiple fallbacks)
// ============================================================

// 1. CoinCap - 2000 tokens per request, no API key!
const COINCAP_API = 'https://api.coincap.io/v2';

// 2. CoinGecko - 100 tokens per request, free tier
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// 3. Moralis - batch pricing, requires API key
const MORALIS_API = 'https://deep-index.moralis.io/api/v2.2';

// ============================================================
// PRICE INDEXER CLASS
// ============================================================

class PriceIndexer {
  private cache: PriceCache = {};
  private cacheTTL = 120; // 2 minutes
  private pendingRequests: Map<string, Promise<TokenPrice[]>> = new Map();

  constructor() {
    console.log('🏗️ PriceIndexer initialized');
  }

  /**
   * Get prices for multiple tokens
   * Uses caching + deduplication
   */
  async getPrices(tokens: { symbol: string; address: string }[]): Promise<Record<string, number>> {
    // Deduplicate tokens by address
    const uniqueTokens = this.deduplicateTokens(tokens);
    
    // Check cache first
    const { cached, missing } = this.checkCache(uniqueTokens);
    
    // If all tokens are cached, return immediately
    if (missing.length === 0) {
      console.log(`✅ All ${uniqueTokens.length} tokens from cache`);
      return cached;
    }

    // Fetch missing tokens
    console.log(`🔍 Fetching ${missing.length} tokens from APIs...`);
    
    // Deduplicate pending requests
    const cacheKey = this.getCacheKey(missing);
    if (this.pendingRequests.has(cacheKey)) {
      console.log('⏳ Waiting for existing request...');
      const result = await this.pendingRequests.get(cacheKey);
      this.pendingRequests.delete(cacheKey);
      return this.mergeResults(cached, result || []);
    }

    // Start new request
    const promise = this.fetchFromMultipleSources(missing);
    this.pendingRequests.set(cacheKey, promise);

    try {
      const results = await promise;
      this.pendingRequests.delete(cacheKey);
      
      // Update cache
      this.updateCache(results);
      
      // Merge with cached results
      return this.mergeResults(cached, results);
    } catch (error) {
      this.pendingRequests.delete(cacheKey);
      console.error('❌ Price fetch failed:', error);
      return cached; // Return cached results even if fetch fails
    }
  }

  /**
   * Try multiple price sources in order
   */
  private async fetchFromMultipleSources(tokens: { symbol: string; address: string }[]): Promise<TokenPrice[]> {
    const sources = [
      { name: 'CoinCap', fn: () => this.fetchFromCoinCap(tokens) },
      { name: 'CoinGecko', fn: () => this.fetchFromCoinGecko(tokens) },
      { name: 'Moralis', fn: () => this.fetchFromMoralis(tokens) },
    ];

    for (const source of sources) {
      try {
        console.log(`🔄 Trying ${source.name}...`);
        const result = await source.fn();
        if (result && result.length > 0) {
          console.log(`✅ ${source.name} succeeded for ${result.length} tokens`);
          return result;
        }
      } catch (error) {
        console.warn(`⚠️ ${source.name} failed:`, error);
      }
    }

    throw new Error('All price sources failed');
  }

  // ============================================================
  // PRICE SOURCE IMPLEMENTATIONS
  // ============================================================

  /**
   * CoinCap - Best for thousands of tokens
   * Supports 2000 tokens per request, no API key needed
   */
  private async fetchFromCoinCap(tokens: { symbol: string; address: string }[]): Promise<TokenPrice[]> {
    // CoinCap uses symbols, not addresses
    const symbols = tokens.map(t => t.symbol).join(',');
    
    const response = await fetch(
      `${COINCAP_API}/assets?ids=${symbols}`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) throw new Error(`CoinCap error: ${response.status}`);

    const data = await response.json();
    
    if (!data.data) return [];

    return data.data.map((item: any) => ({
      symbol: item.symbol,
      address: tokens.find(t => t.symbol === item.symbol)?.address || '',
      price: parseFloat(item.priceUsd) || 0,
      priceChange24h: parseFloat(item.changePercent24Hr) || 0,
      lastUpdated: Date.now(),
      source: 'CoinCap',
    }));
  }

  /**
   * CoinGecko - Good fallback
   * Supports 100 tokens per request
   */
  private async fetchFromCoinGecko(tokens: { symbol: string; address: string }[]): Promise<TokenPrice[]> {
    // Map symbols to CoinGecko IDs (maintain a small mapping for major tokens)
    const SYMBOL_MAP: Record<string, string> = {
      'ETH': 'ethereum',
      'USDC': 'usd-coin',
      'USDT': 'tether',
      'WBTC': 'wrapped-bitcoin',
      'LINK': 'chainlink',
      'UNI': 'uniswap',
      'MATIC': 'polygon',
      'BNB': 'binancecoin',
      'ARB': 'arbitrum',
      'OP': 'optimism',
      'AVAX': 'avalanche-2',
      'DAI': 'dai',
      'AAVE': 'aave',
      'SOL': 'solana',
      'MKR': 'maker',
      'CRV': 'curve-dao-token',
    };

    const validTokens = tokens.filter(t => SYMBOL_MAP[t.symbol]);
    if (validTokens.length === 0) return [];

    const ids = validTokens.map(t => SYMBOL_MAP[t.symbol]).join(',');
    const response = await fetch(
      `${COINGECKO_API}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) throw new Error(`CoinGecko error: ${response.status}`);

    const data = await response.json();

    return validTokens.map(t => ({
      symbol: t.symbol,
      address: t.address,
      price: data[SYMBOL_MAP[t.symbol]]?.usd || 0,
      priceChange24h: data[SYMBOL_MAP[t.symbol]]?.usd_24h_change || 0,
      lastUpdated: Date.now(),
      source: 'CoinGecko',
    }));
  }

  /**
   * Moralis - Best for accurate prices with API key
   */
  private async fetchFromMoralis(tokens: { symbol: string; address: string }[]): Promise<TokenPrice[]> {
    const apiKey = process.env.MORALIS_API_KEY;
    if (!apiKey) throw new Error('Moralis API key not configured');

    // Process in batches of 100
    const results: TokenPrice[] = [];
    const batchSize = 100;

    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);
      const addresses = batch.map(t => t.address).join(',');

      const response = await fetch(
        `${MORALIS_API}/erc20/prices?chain=eth&token_addresses=${addresses}`,
        { headers: { 'x-api-key': apiKey } }
      );

      if (!response.ok) continue;

      const data = await response.json();
      
      data.forEach((item: any) => {
        const token = batch.find(t => t.address.toLowerCase() === item.address.toLowerCase());
        if (token) {
          results.push({
            symbol: token.symbol,
            address: token.address,
            price: item.usdPrice || 0,
            priceChange24h: item.usdPrice24hPercentChange || 0,
            lastUpdated: Date.now(),
            source: 'Moralis',
          });
        }
      });
    }

    return results;
  }

  // ============================================================
  // CACHE MANAGEMENT
  // ============================================================

  private checkCache(tokens: { symbol: string; address: string }[]): {
    cached: Record<string, number>;
    missing: { symbol: string; address: string }[];
  } {
    const cached: Record<string, number> = {};
    const missing: { symbol: string; address: string }[] = [];
    const now = Date.now();

    tokens.forEach(token => {
      const entry = this.cache[token.address];
      if (entry && (now - entry.timestamp) < this.cacheTTL * 1000) {
        cached[token.symbol] = entry.price;
      } else {
        missing.push(token);
      }
    });

    return { cached, missing };
  }

  private updateCache(prices: TokenPrice[]): void {
    prices.forEach(p => {
      this.cache[p.address] = {
        price: p.price,
        timestamp: p.lastUpdated,
        source: p.source,
      };
    });
  }

  private mergeResults(
    cached: Record<string, number>,
    results: TokenPrice[]
  ): Record<string, number> {
    const merged = { ...cached };
    results.forEach(p => {
      merged[p.symbol] = p.price;
    });
    return merged;
  }

  private deduplicateTokens(tokens: { symbol: string; address: string }[]): { symbol: string; address: string }[] {
    const seen = new Set<string>();
    return tokens.filter(t => {
      const key = t.address.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private getCacheKey(tokens: { symbol: string; address: string }[]): string {
    return tokens.map(t => t.address).sort().join(',');
  }

  /**
   * Clear cache for a specific token
   */
  clearCache(address: string): void {
    delete this.cache[address.toLowerCase()];
  }

  /**
   * Clear entire cache
   */
  clearAllCache(): void {
    this.cache = {};
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: Object.keys(this.cache).length,
      keys: Object.keys(this.cache),
    };
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

let priceIndexerInstance: PriceIndexer | null = null;

export function getPriceIndexer(): PriceIndexer {
  if (!priceIndexerInstance) {
    priceIndexerInstance = new PriceIndexer();
  }
  return priceIndexerInstance;
}

// ============================================================
// EXPRESSIVE API
// ============================================================

/**
 * Get prices for multiple tokens
 * Uses the PriceIndexer singleton
 */
export async function getTokenPricesFromIndexer(
  tokens: { symbol: string; address: string }[]
): Promise<Record<string, number>> {
  const indexer = getPriceIndexer();
  return indexer.getPrices(tokens);
}

// Backward compatibility with existing code
export async function getMultipleTokenPrices(symbols: string[]): Promise<Record<string, number>> {
  // This requires address mapping - but you should use the indexed approach
  // For now, return zeros for unmapped tokens
  const result: Record<string, number> = {};
  symbols.forEach(s => { result[s] = 0; });
  return result;
}