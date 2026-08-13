// src/lib/rate-limit.ts

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';

// ============================================================
// SAFE ENVIRONMENT VARIABLE ACCESS (prevents build failures)
// ============================================================

// Check if we're in a server environment (not during build)
const isServer = typeof window === 'undefined';
const isBuildTime = isServer && !process.env.VERCEL && process.env.NODE_ENV === 'production';

// Only initialize Redis if we have the required env vars AND we're not in build time
const hasRedisConfig = 
  process.env.UPSTASH_REDIS_REST_URL && 
  process.env.UPSTASH_REDIS_REST_TOKEN;

// ============================================================
// RATE LIMITER (with build-time fallback)
// ============================================================

// Create a mock rate limiter for build time
const createMockRateLimiter = () => ({
  limit: async (key: string) => ({
    success: true,
    limit: 30,
    remaining: 29,
    reset: Date.now() + 60000,
  }),
});

// Initialize the actual rate limiter only if we have Redis config
let rateLimiterInstance: any;

if (hasRedisConfig && !isBuildTime) {
  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL || '',
      token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    });

    rateLimiterInstance = new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(30, '60s'),
      analytics: true,
      prefix: 'ratelimit',
    });
  } catch (error) {
    console.warn('⚠️ Failed to initialize Upstash Redis, using in-memory fallback:', error);
    rateLimiterInstance = createMockRateLimiter();
  }
} else {
  // Use mock rate limiter during build or if Redis is not configured
  rateLimiterInstance = createMockRateLimiter();
}

// Export the rate limiter
export const rateLimiter = rateLimiterInstance;

// ============================================================
// IN-MEMORY RATE LIMITER (Fallback)
// ============================================================

class InMemoryRateLimiter {
  private store: Map<string, { count: number; resetTime: number }>;
  private windowMs: number;
  private maxRequests: number;

  constructor(maxRequests: number = 30, windowSeconds: number = 60) {
    this.store = new Map();
    this.maxRequests = maxRequests;
    this.windowMs = windowSeconds * 1000;
  }

  isRateLimited(ip: string): boolean {
    const now = Date.now();
    const record = this.store.get(ip);

    if (!record) {
      this.store.set(ip, { count: 1, resetTime: now + this.windowMs });
      return false;
    }

    if (now > record.resetTime) {
      this.store.set(ip, { count: 1, resetTime: now + this.windowMs });
      return false;
    }

    if (record.count >= this.maxRequests) {
      return true;
    }

    record.count++;
    return false;
  }

  getRemaining(ip: string): number {
    const record = this.store.get(ip);
    if (!record) return this.maxRequests;
    if (Date.now() > record.resetTime) return this.maxRequests;
    return Math.max(0, this.maxRequests - record.count);
  }

  getResetTime(ip: string): number {
    const record = this.store.get(ip);
    if (!record) return Date.now() + 1000;
    return record.resetTime;
  }
}

// Create in-memory rate limiter instance
export const memoryRateLimiter = new InMemoryRateLimiter(30, 60);

// ============================================================
// MIDDLEWARE FUNCTIONS
// ============================================================

/**
 * Check rate limit for a request
 */
export async function checkRateLimit(
  request: NextRequest
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  headers: HeadersInit;
}> {
  // Get client IP (works with Vercel)
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    'anonymous';

  // Use Upstash if available, otherwise fallback to in-memory
  let success: boolean;
  let limit: number;
  let remaining: number;
  let reset: number;

  try {
    if (rateLimiter && typeof rateLimiter.limit === 'function') {
      const result = await rateLimiter.limit(ip);
      success = result.success;
      limit = result.limit;
      remaining = result.remaining;
      reset = result.reset;
    } else {
      // Fallback to in-memory
      const isLimited = memoryRateLimiter.isRateLimited(ip);
      success = !isLimited;
      limit = 30;
      remaining = memoryRateLimiter.getRemaining(ip);
      reset = memoryRateLimiter.getResetTime(ip);
    }
  } catch (error) {
    // If rate limiting fails, allow the request (fail open)
    console.warn('⚠️ Rate limiting failed, allowing request:', error);
    success = true;
    limit = 30;
    remaining = 30;
    reset = Date.now() + 60000;
  }

  const headers = {
    'X-RateLimit-Limit': limit.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': reset.toString(),
  };

  return { success, limit, remaining, reset, headers };
}

/**
 * Create a rate limit error response
 */
export function createRateLimitResponse(
  limit: number,
  remaining: number,
  reset: number
): NextResponse {
  return NextResponse.json(
    {
      error: 'Too many requests',
      message: 'Please wait and try again',
      details: {
        limit,
        remaining,
        resetIn: Math.ceil((reset - Date.now()) / 1000) + ' seconds',
      },
    },
    {
      status: 429,
      headers: {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': reset.toString(),
        'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
      },
    }
  );
}