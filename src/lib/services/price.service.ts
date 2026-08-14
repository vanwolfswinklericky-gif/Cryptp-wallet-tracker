// src/lib/services/price.service.ts
import { cache, getPriceCacheKey } from '@/lib/cache';

export class PriceService {
  private static instance: PriceService;

  private constructor() {}

  static getInstance(): PriceService {
    if (!PriceService.instance) {
      PriceService.instance = new PriceService();
    }
    return PriceService.instance;
  }

  async getPrices(symbols: string[]): Promise<Record<string, number>> {
    if (!symbols || symbols.length === 0) {
      return {};
    }

    const cacheKey = getPriceCacheKey(symbols);
    const cached = cache.get<Record<string, number>>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const prices: Record<string, number> = {};
    symbols.forEach(symbol => {
      prices[symbol] = this.getDefaultPrice(symbol);
    });

    cache.set(cacheKey, prices, 30);
    return prices;
  }

  async getPrice(symbol: string): Promise<number> {
    const prices = await this.getPrices([symbol]);
    return prices[symbol] || 0;
  }

  private getDefaultPrice(symbol: string): number {
    const defaultPrices: Record<string, number> = {
      'ETH': 3200,
      'USDC': 1,
      'USDT': 1,
      'WBTC': 61000,
      'LINK': 14,
      'UNI': 7.80,
      'MATIC': 0.50,
      'BNB': 580,
      'ARB': 0.75,
      'OP': 1.80,
      'AVAX': 28,
      'DAI': 1,
      'AAVE': 100,
      'SOL': 160,
      'MKR': 1200,
      'CRV': 0.50,
      'CVX': 5.00,
    };
    return defaultPrices[symbol] || 0;
  }
}