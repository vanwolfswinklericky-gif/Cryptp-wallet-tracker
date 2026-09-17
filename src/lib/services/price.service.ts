// src/lib/services/price.service.ts
import { cache, getPriceCacheKey } from '@/lib/cache';
import { logger } from '@/lib/logger';

// Known contract addresses → CoinGecko IDs (fallback when Alchemy fails)
const SYMBOL_TO_COINGECKO: Record<string, string> = {
  ETH: 'ethereum',
  WETH: 'weth',
  BTC: 'bitcoin',
  WBTC: 'wrapped-bitcoin',
  USDC: 'usd-coin',
  USDT: 'tether',
  DAI: 'dai',
  BUSD: 'binance-usd',
  TUSD: 'true-usd',
  FRAX: 'frax',
  LINK: 'chainlink',
  UNI: 'uniswap',
  MATIC: 'matic-network',
  WMATIC: 'wmatic',
  BNB: 'binancecoin',
  WBNB: 'wbnb',
  AVAX: 'avalanche-2',
  WAVAX: 'wrapped-avax',
  ARB: 'arbitrum',
  OP: 'optimism',
  SOL: 'solana',
  AAVE: 'aave',
  MKR: 'maker',
  CRV: 'curve-dao-token',
  CVX: 'convex-finance',
  COMP: 'compound-governance-token',
  SNX: 'synthetix-network-token',
  BAT: 'basic-attention-token',
  MANA: 'decentraland',
  SAND: 'the-sandbox',
  APE: 'apecoin',
  GRT: 'the-graph',
  '1INCH': '1inch',
  SUSHI: 'sushi',
  GEL: 'gelato',
  SHIB: 'shiba-inu',
  DOGE: 'dogecoin',
  PEPE: 'pepe',
};

export class PriceService {
  private static instance: PriceService;
  private inFlightRequests: Map<string, Promise<number>> = new Map();

  private constructor() {}

  static getInstance(): PriceService {
    if (!PriceService.instance) {
      PriceService.instance = new PriceService();
    }
    return PriceService.instance;
  }

  /**
   * ✅ Get live price for a single token symbol
   */
  async getPrice(symbol: string): Promise<number> {
    const prices = await this.getPrices([symbol]);
    return prices[symbol.toUpperCase()] || 0;
  }

  /**
   * ✅ Get live prices for multiple token symbols
   * Uses /api/prices endpoint internally (Alchemy → CoinGecko → GeckoTerminal)
   */
  async getPrices(symbols: string[]): Promise<Record<string, number>> {
    if (!symbols || symbols.length === 0) return {};

    // Normalize symbols (uppercase, dedupe)
    const normalizedSymbols = Array.from(
      new Set(symbols.map((s) => s.toUpperCase()).filter(Boolean))
    );

    // Check cache first
    const cacheKey = getPriceCacheKey(normalizedSymbols);
    const cached = cache.get<Record<string, number>>(cacheKey);
    if (cached) {
      logger.info(`📦 Price cache hit for ${normalizedSymbols.length} symbols`);
      return cached;
    }

    logger.info(`🔍 Fetching live prices for ${normalizedSymbols.length} symbols`);

    const prices: Record<string, number> = {};

    // Fetch prices in parallel (deduplicate concurrent requests for the same symbol)
    await Promise.all(
      normalizedSymbols.map(async (symbol) => {
        const price = await this.fetchSingleSymbolPrice(symbol);
        prices[symbol] = price;
      })
    );

    // Log results
    const hitCount = Object.values(prices).filter((p) => p > 0).length;
    logger.info(`✅ Live prices: ${hitCount}/${normalizedSymbols.length} resolved`);

    // Cache for 60 seconds
    cache.set(cacheKey, prices, 60);
    return prices;
  }

  /**
   * ✅ Fetch a single symbol's price with deduplication
   * Prevents duplicate in-flight requests for the same symbol
   */
  private async fetchSingleSymbolPrice(symbol: string): Promise<number> {
    // Deduplicate in-flight requests
    if (this.inFlightRequests.has(symbol)) {
      return this.inFlightRequests.get(symbol)!;
    }

    const promise = this.resolveSymbolPrice(symbol);
    this.inFlightRequests.set(symbol, promise);

    try {
      return await promise;
    } finally {
      this.inFlightRequests.delete(symbol);
    }
  }

  /**
   * ✅ Resolve a symbol to a price using the tiered pipeline
   * Tier 1: CoinGecko (by symbol/ID)
   * Tier 2: Fallback for special cases
   */
  private async resolveSymbolPrice(symbol: string): Promise<number> {
    // Handle USD stablecoins (always $1)
    if (['USDC', 'USDT', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'USDP', 'GUSD'].includes(symbol)) {
      return 1;
    }

    const cgId = SYMBOL_TO_COINGECKO[symbol];
    if (!cgId) {
      logger.warn(`⚠️ No CoinGecko mapping for symbol: ${symbol}`);
      return 0;
    }

    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`;
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Crypto-Wallet-Tracker/1.0',
        },
      });

      if (!response.ok) {
        logger.warn(`⚠️ CoinGecko error for ${symbol}: ${response.status}`);
        return 0;
      }

      const data = await response.json();
      const price = data[cgId]?.usd;

      if (typeof price === 'number' && price > 0) {
        logger.info(`  ✅ ${symbol}: $${price}`);
        return price;
      }

      return 0;
    } catch (error) {
      logger.warn(`⚠️ Failed to fetch price for ${symbol}:`, error);
      return 0;
    }
  }

  /**
   * ✅ Batch fetch prices with rate limiting
   * Use this for large lists (e.g., 100+ tokens)
   */
  async getPricesBatch(
    symbols: string[],
    batchSize: number = 10,
    delayMs: number = 1000
  ): Promise<Record<string, number>> {
    if (!symbols || symbols.length === 0) return {};

    const normalized = Array.from(
      new Set(symbols.map((s) => s.toUpperCase()).filter(Boolean))
    );

    const prices: Record<string, number> = {};

    for (let i = 0; i < normalized.length; i += batchSize) {
      const batch = normalized.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(async (symbol) => ({
          symbol,
          price: await this.resolveSymbolPrice(symbol),
        }))
      );

      batchResults.forEach(({ symbol, price }) => {
        prices[symbol] = price;
      });

      // Rate limit between batches
      if (i + batchSize < normalized.length) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return prices;
  }
}

export const priceService = PriceService.getInstance();