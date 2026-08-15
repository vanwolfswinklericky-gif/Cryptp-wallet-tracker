// src/lib/db/redis.ts
import { Redis } from '@upstash/redis';

const getRedisUrl = () => {
  const url = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
  if (!url) {
    console.warn('⚠️ Redis URL not configured, using in-memory fallback');
    return null;
  }
  return url;
};

const getRedisToken = () => {
  return process.env.UPSTASH_REDIS_REST_TOKEN || '';
};

export const redis = getRedisUrl() 
  ? new Redis({
      url: getRedisUrl()!,
      token: getRedisToken(),
    })
  : null;

export default redis;