// lib/cache/index.ts
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

interface CacheStats {
  size: number;
  keys: string[];
  totalHits: number;
  totalMisses: number;
}

class Cache {
  private store: Map<string, CacheEntry<any>>;
  private defaultTTL: number;
  private hits: number = 0;
  private misses: number = 0;

  constructor(defaultTTL: number = 60) {
    this.store = new Map();
    this.defaultTTL = defaultTTL;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    const expiresIn = ttl || this.defaultTTL;
    this.store.set(key, {
      data,
      timestamp: Date.now(),
      ttl: expiresIn,
      hits: 0,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    const now = Date.now();
    const age = (now - entry.timestamp) / 1000;

    if (age > entry.ttl) {
      this.store.delete(key);
      this.misses++;
      return null;
    }

    entry.hits++;
    this.hits++;
    return entry.data as T;
  }

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

  delete(key: string): void {
    this.store.delete(key);
  }

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

  clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
  }

  stats(): CacheStats {
    return {
      size: this.store.size,
      keys: Array.from(this.store.keys()),
      totalHits: this.hits,
      totalMisses: this.misses,
    };
  }

  hitRate(): number {
    const total = this.hits + this.misses;
    if (total === 0) return 0;
    return (this.hits / total) * 100;
  }

  logStats(): void {
    const stats = this.stats();
    console.log(`📊 Cache Stats:`);
    console.log(`   Size: ${stats.size} entries`);
    console.log(`   Hits: ${stats.totalHits}`);
    console.log(`   Misses: ${stats.totalMisses}`);
    console.log(`   Hit Rate: ${this.hitRate().toFixed(1)}%`);
  }
}

export const cache = new Cache(60);

export function getWalletCacheKey(address: string, chain: string, includeTxs: boolean): string {
  return `wallet:${chain}:${address}:${includeTxs ? 'full' : 'balance'}`;
}

export function getTokenCacheKey(address: string, chain: string): string {
  return `tokens:${chain}:${address}`;
}

export function getBitcoinCacheKey(address: string): string {
  return `btc:${address}`;
}

export function getSolanaCacheKey(address: string): string {
  return `sol:${address}`;
}

export function getPriceCacheKey(symbols: string[]): string {
  const sorted = [...symbols].sort().join(',');
  return `prices:${sorted}`;
}

export function getTransactionCacheKey(address: string, chain: string, limit: number): string {
  return `txs:${chain}:${address}:${limit}`;
}