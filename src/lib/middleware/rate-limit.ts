// src/lib/middleware/rate-limit.ts
import { NextRequest } from 'next/server';

// Simple in-memory rate limiting
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export const rateLimit = {
  async check(
    ip: string,
    endpoint: string,
    limit: number = 10,
    windowSeconds: number = 60
  ): Promise<boolean> {
    const key = `${ip}:${endpoint}`;
    const now = Date.now();
    const resetAt = now + windowSeconds * 1000;

    const existing = rateLimitStore.get(key);
    if (!existing || existing.resetAt < now) {
      rateLimitStore.set(key, { count: 1, resetAt });
      return false;
    }

    if (existing.count >= limit) {
      return true; // Rate limited
    }

    existing.count++;
    rateLimitStore.set(key, existing);
    return false;
  },
};