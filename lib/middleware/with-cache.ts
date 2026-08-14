// lib/middleware/with-cache.ts
import { NextRequest, NextResponse } from 'next/server';
import { cache } from '@/lib/cache';

interface CacheOptions {
  key?: string;
  ttl?: number;
}

export async function withCache(
  request: NextRequest,
  handler: () => Promise<NextResponse>,
  options: CacheOptions = {}
): Promise<NextResponse> {
  const url = new URL(request.url);
  const cacheKey = options.key || url.pathname + url.search;
  const ttl = options.ttl || 60;

  // Check cache
  const cached = cache.get<string>(cacheKey);
  if (cached) {
    const response = NextResponse.json(JSON.parse(cached), {
      status: 200,
      headers: {
        'X-Cache': 'HIT',
        'Cache-Control': `s-maxage=${ttl}, stale-while-revalidate=${ttl / 2}`,
      },
    });
    return response;
  }

  // Execute handler
  const response = await handler();
  
  // Cache response if successful
  if (response.status === 200) {
    const data = await response.clone().json();
    cache.set(cacheKey, JSON.stringify(data), ttl);
    response.headers.set('X-Cache', 'MISS');
  }

  return response;
}