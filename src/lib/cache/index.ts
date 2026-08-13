// src/lib/cache/index.ts

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in seconds
  hits: number; // Track how many times this entry was accessed
}

interface CacheStats {
  size: number;
  keys: string[];
  totalHits: number;
  totalMisses: number;
}

/**
 * Simple in-memory cache with TTL
 * Works on Vercel serverless functions (per-instance)
 */
class Cache {
  private store: Map<string, CacheEntry<any>>;
  private defaultTTL: number;
  private hits: number = 0;
  private misses: number = 0;

  constructor(defaultTTL: number = 60) {
    this.store = new Map();
    this.defaultTTL = defaultTTL;
  }

  /**
   * Set a value in the cache
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const expiresIn = ttl || this.defaultTTL;
    this.store.set(key, {
      data,
      timestamp: Date.now(),
      ttl: expiresIn,
      hits: 0,
    });
  }

  /**
   * Get a value from the cache
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    const now = Date.now();
    const age = (now - entry.timestamp) / 1000; // Age in seconds

    // Check if entry has expired
    if (age > entry.ttl) {
      this.store.delete(key);
      this.misses++;
      return null;
    }

    // Update hit count
    entry.hits++;
    this.hits++;
    return entry.data as T;
  }

  /**
   * Get a value with metadata (for debugging)
   */
  getWithMeta<T>(key: string): { data: T; age: number; ttl: number; hits: number } | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    const now = Date.now();
    const age = (now - entry.timestamp) / 1000;

    if (age > entry.ttl) {
      this.store.delete(key);
      return null;
    }

    return {
      data: entry.data as T,
      age,
      ttl: entry.ttl,
      hits: entry.hits,
    };
  }

  /**
   * Check if a key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;

    const now = Date.now();
    const age = (now - entry.timestamp) / 1000;
    if (age > entry.ttl) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get the remaining TTL for a key in seconds
   */
  getTTL(key: string): number | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    const now = Date.now();
    const age = (now - entry.timestamp) / 1000;
    const remaining = entry.ttl - age;

    if (remaining <= 0) {
      this.store.delete(key);
      return null;
    }

    return remaining;
  }

  /**
   * Delete a key from the cache
   */
  delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * Delete keys matching a pattern
   */
  deletePattern(pattern: string): number {
    const keysToDelete = Array.from(this.store.keys()).filter(key => 
      key.includes(pattern)
    );
    let count = 0;
    keysToDelete.forEach(key => {
      this.store.delete(key);
      count++;
    });
    return count;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  stats(): CacheStats {
    return {
      size: this.store.size,
      keys: Array.from(this.store.keys()),
      totalHits: this.hits,
      totalMisses: this.misses,
    };
  }

  /**
   * Get hit rate (percentage)
   */
  hitRate(): number {
    const total = this.hits + this.misses;
    if (total === 0) return 0;
    return (this.hits / total) * 100;
  }

  /**
   * Log cache statistics to console
   */
  logStats(): void {
    const stats = this.stats();
    console.log(`📊 Cache Stats:`);
    console.log(`   Size: ${stats.size} entries`);
    console.log(`   Hits: ${stats.totalHits}`);
    console.log(`   Misses: ${stats.totalMisses}`);
    console.log(`   Hit Rate: ${this.hitRate().toFixed(1)}%`);
    if (stats.size > 0 && stats.size < 10) {
      console.log(`   Keys: ${stats.keys.join(', ')}`);
    }
  }
}

// Create singleton instance with 60 second default TTL
export const cache = new Cache(60);

// ============================================================
// CACHE UTILITIES
// ============================================================

/**
 * Generate a cache key for wallet data
 */
export function getWalletCacheKey(address: string, chain: string, includeTxs: boolean): string {
  return `wallet:${chain}:${address}:${includeTxs ? 'full' : 'balance'}`;
}

/**
 * Generate a cache key for token balances
 */
export function getTokenCacheKey(address: string, chain: string): string {
  return `tokens:${chain}:${address}`;
}

/**
 * Generate a cache key for Bitcoin balance
 */
export function getBitcoinCacheKey(address: string): string {
  return `btc:${address}`;
}

/**
 * Generate a cache key for Solana balance
 */
export function getSolanaCacheKey(address: string): string {
  return `sol:${address}`;
}

/**
 * Generate a cache key for prices
 */
export function getPriceCacheKey(symbols: string[]): string {
  const sorted = [...symbols].sort().join(',');
  return `prices:${sorted}`;
}

/**
 * Generate a cache key for transactions
 */
export function getTransactionCacheKey(address: string, chain: string, limit: number): string {
  return `txs:${chain}:${address}:${limit}`;
}

/**
 * Generate a cache key for Bitcoin transactions
 */
export function getBitcoinTransactionCacheKey(address: string, limit: number): string {
  return `btc:txs:${address}:${limit}`;
}

/**
 * Generate a cache key for Solana transactions
 */
export function getSolanaTransactionCacheKey(address: string, limit: number): string {
  return `sol:txs:${address}:${limit}`;
}

/**
 * Cached fetch wrapper with retry and error handling
 */
export async function cachedFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = 60,
  retries: number = 2
): Promise<T> {
  // Check cache first
  const cached = cache.get<T>(key);
  if (cached !== null) {
    const ttlRemaining = cache.getTTL(key);
    console.log(`✅ Cache hit for: ${key} (${ttlRemaining?.toFixed(0)}s remaining)`);
    return cached;
  }

  // Fetch fresh data with retries
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`🔄 Cache miss for: ${key} (attempt ${attempt + 1}/${retries + 1})`);
      const data = await fetchFn();
      cache.set(key, data, ttl);
      console.log(`💾 Cached: ${key} (TTL: ${ttl}s)`);
      return data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`⚠️ Fetch attempt ${attempt + 1} failed:`, lastError.message);
      
      // Wait before retrying (exponential backoff)
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error(`Failed to fetch data for key: ${key}`);
}

/**
 * Clear all cache for a specific chain
 */
export function clearChainCache(chain: string): number {
  const pattern = `:${chain}:`;
  return cache.deletePattern(pattern);
}

/**
 * Clear cache for a specific address
 */
export function clearAddressCache(address: string, chain?: string): number {
  const keys = [
    getWalletCacheKey(address, chain || 'ethereum', false),
    getWalletCacheKey(address, chain || 'ethereum', true),
    getBitcoinCacheKey(address),
    getSolanaCacheKey(address),
    getTransactionCacheKey(address, chain || 'ethereum', 10),
    getBitcoinTransactionCacheKey(address, 10),
    getSolanaTransactionCacheKey(address, 10),
  ];
  
  let count = 0;
  keys.forEach(key => {
    if (cache.has(key)) {
      cache.delete(key);
      count++;
    }
  });
  
  return count;
}

/**
 * Get cache statistics as a formatted string
 */
export function getCacheStatsString(): string {
  const stats = cache.stats();
  return `Cache: ${stats.size} entries, ${stats.totalHits} hits, ${stats.totalMisses} misses (${cache.hitRate().toFixed(1)}% hit rate)`;
}