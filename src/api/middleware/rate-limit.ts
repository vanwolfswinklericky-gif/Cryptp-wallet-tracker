// src/api/middleware/rate-limit.ts

import { NextRequest, NextResponse } from 'next/server';
import { cache } from '@/lib/cache';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private static instance: RateLimiter;
  private limit: number;
  private windowMs: number;

  private constructor(limit: number = 60, windowSeconds: number = 60) {
    this.limit = limit;
    this.windowMs = windowSeconds * 1000;
  }

  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  async check(request: NextRequest): Promise<{ allowed: boolean; headers: Record<string, string> }> {
    // ✅ Get client IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               'unknown';

    const key = `ratelimit:${ip}`;
    const now = Date.now();

    // ✅ Get current rate limit data
    let entry = cache.get<RateLimitEntry>(key);
    
    if (!entry || now > entry.resetTime) {
      entry = { count: 0, resetTime: now + this.windowMs };
    }

    const isAllowed = entry.count < this.limit;
    
    if (isAllowed) {
      entry.count++;
      cache.set(key, entry, Math.ceil(this.windowMs / 1000));
    }

    const resetIn = Math.ceil((entry.resetTime - now) / 1000);

    return {
      allowed: isAllowed,
      headers: {
        'X-RateLimit-Limit': this.limit.toString(),
        'X-RateLimit-Remaining': isAllowed ? (this.limit - entry.count).toString() : '0',
        'X-RateLimit-Reset': resetIn.toString(),
      },
    };
  }
}