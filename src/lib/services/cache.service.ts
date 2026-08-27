// src/lib/services/cache.service.ts
import { redis } from '@/lib/redis';

export const CacheService = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key);
      if (data) {
        return JSON.parse(data);
      }
      return null;
    } catch {
      return null;
    }
  },

  async set<T>(key: string, value: T, ttl: number = 300): Promise<void> {
    try {
      await redis.set(key, JSON.stringify(value), ttl);
    } catch {
      // Silently fail
    }
  },

  async delete(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch {
      // Silently fail
    }
  },

  async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(pattern);
      for (const key of keys) {
        await redis.del(key);
      }
    } catch {
      // Silently fail
    }
  },

  generateKey(prefix: string, params: any): string {
    const sorted = Object.keys(params)
      .sort()
      .reduce((acc, key) => ({ ...acc, [key]: params[key] }), {});
    return `${prefix}:${JSON.stringify(sorted)}`;
  },
};