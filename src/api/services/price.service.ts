// src/api/services/price.service.ts

import { PriceData } from '../types';
import { getMultipleTokenPrices } from '@/lib/prices';
import { cache } from '@/lib/cache';

export class PriceService {
  private static instance: PriceService;
  private cacheTTL = 30; // 30 seconds

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

    // ✅ Check cache
    const cacheKey = `prices:${symbols.sort().join(',')}`;
    const cached = cache.get<Record<string, number>>(cacheKey);
    
    if (cached) {
      console.log(`✅ Cache hit for prices: ${symbols.join(', ')}`);
      return cached;
    }

    try {
      const prices = await getMultipleTokenPrices(symbols);
      
      // ✅ Cache the result
      cache.set(cacheKey, prices, this.cacheTTL);

      return prices;
    } catch (error) {
      console.error('Price fetch error:', error);
      return {};
    }
  }

  async getPrice(symbol: string): Promise<number> {
    const prices = await this.getPrices([symbol]);
    return prices[symbol] || 0;
  }

  async getPricesForTokens(
    tokens: { symbol: string; address: string }[]
  ): Promise<Record<string, number>> {
    const symbols = tokens.map(t => t.symbol);
    return this.getPrices(symbols);
  }
}