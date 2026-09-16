// src/lib/services/price-cache.service.ts
import { redis } from '@/lib/redis';

export class PriceCacheService {
  private static instance: PriceCacheService;
  private readonly TTL = {
    majorToken: 60,        // 1 min for ETH, USDC, etc.
    midToken: 300,         // 5 min for mid-tier
    longTailToken: 900,    // 15 min for long-tail
    unknownToken: 3600,    // 1 hour for unknown
  };

  static getInstance(): PriceCacheService {
    if (!PriceCacheService.instance) {
      PriceCacheService.instance = new PriceCacheService();
    }
    return PriceCacheService.instance;
  }

  async get(address: string, chain: string): Promise<number | null> {
    const key = `price:${chain}:${address.toLowerCase()}`;
    const cached = await redis.get(key);
    return cached ? parseFloat(cached) : null;
  }

  async set(address: string, chain: string, price: number, tier: keyof typeof this.TTL = 'midToken'): Promise<void> {
    const key = `price:${chain}:${address.toLowerCase()}`;
    await redis.set(key, price.toString(), this.TTL[tier]);
  }

  async setMany(prices: Array<{ address: string; chain: string; price: number; tier?: keyof typeof this.TTL }>): Promise<void> {
    const pipeline = redis.pipeline();
    for (const { address, chain, price, tier = 'midToken' } of prices) {
      const key = `price:${chain}:${address.toLowerCase()}`;
      pipeline.set(key, price.toString(), 'EX', this.TTL[tier]);
    }
    await pipeline.exec();
  }

  async getMany(addresses: string[], chain: string): Promise<Map<string, number>> {
    if (addresses.length === 0) return new Map();
    
    const keys = addresses.map(a => `price:${chain}:${a.toLowerCase()}`);
    const values = await redis.mget(...keys);
    
    const result = new Map<string, number>();
    addresses.forEach((addr, i) => {
      if (values[i]) {
        result.set(addr.toLowerCase(), parseFloat(values[i]!));
      }
    });
    return result;
  }
}

export const priceCache = PriceCacheService.getInstance();