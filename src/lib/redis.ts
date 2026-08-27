// src/lib/redis.ts
import Redis from 'ioredis';

// ✅ Singleton Redis client
let redisClient: Redis | null = null;

// Redis connection options
const getRedisConfig = () => {
  const url = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
  
  if (url) {
    // For Upstash/Redis URL format
    return {
      url,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    };
  }

  // For local Redis (default)
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableReadyCheck: false,
  };
};

// ✅ Get or create Redis client
export function getRedisClient(): Redis | null {
  if (redisClient) {
    return redisClient;
  }

  try {
    const config = getRedisConfig();
    
    // Check if we have Redis configuration
    if (!config.url && !config.host) {
      console.warn('⚠️ Redis not configured - using in-memory fallback');
      return null;
    }

    // Create Redis client
    redisClient = new Redis(config);
    
    // Handle connection events
    redisClient.on('connect', () => {
      console.log('✅ Redis connected');
    });

    redisClient.on('error', (error) => {
      console.error('❌ Redis error:', error.message);
      // Don't throw - allow fallback to in-memory
    });

    redisClient.on('close', () => {
      console.log('🔴 Redis connection closed');
    });

    return redisClient;
  } catch (error) {
    console.error('❌ Failed to initialize Redis:', error);
    return null;
  }
}

// ✅ Redis operations with fallback
export const redis = {
  /**
   * Get a value from Redis
   */
  async get(key: string): Promise<string | null> {
    try {
      const client = getRedisClient();
      if (!client) {
        console.warn(`⚠️ Redis unavailable - get(${key}) returning null`);
        return null;
      }
      return await client.get(key);
    } catch (error) {
      console.error('Redis GET error:', error);
      return null;
    }
  },

  /**
   * Set a value in Redis with optional TTL
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      const client = getRedisClient();
      if (!client) {
        console.warn(`⚠️ Redis unavailable - set(${key}) skipped`);
        return;
      }
      if (ttl) {
        await client.setex(key, ttl, value);
      } else {
        await client.set(key, value);
      }
    } catch (error) {
      console.error('Redis SET error:', error);
      // Don't throw - application should continue
    }
  },

  /**
   * Delete a key from Redis
   */
  async del(key: string): Promise<void> {
    try {
      const client = getRedisClient();
      if (!client) {
        console.warn(`⚠️ Redis unavailable - del(${key}) skipped`);
        return;
      }
      await client.del(key);
    } catch (error) {
      console.error('Redis DEL error:', error);
    }
  },

  /**
   * Delete all keys matching a pattern
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      const client = getRedisClient();
      if (!client) {
        console.warn(`⚠️ Redis unavailable - keys(${pattern}) returning []`);
        return [];
      }
      return await client.keys(pattern);
    } catch (error) {
      console.error('Redis KEYS error:', error);
      return [];
    }
  },

  /**
   * Check if Redis is connected
   */
  isConnected(): boolean {
    const client = getRedisClient();
    return client ? client.status === 'ready' : false;
  },

  /**
   * Ping Redis server
   */
  async ping(): Promise<boolean> {
    try {
      const client = getRedisClient();
      if (!client) return false;
      const result = await client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  },

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    try {
      if (redisClient) {
        await redisClient.quit();
        redisClient = null;
        console.log('🔴 Redis disconnected');
      }
    } catch (error) {
      console.error('Redis disconnect error:', error);
    }
  },
};

// ✅ Export default for convenience
export default redis;