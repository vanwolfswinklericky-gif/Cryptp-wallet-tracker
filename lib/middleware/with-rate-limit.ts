// lib/middleware/with-rate-limit.ts
import { NextRequest, NextResponse } from 'next/server';
import { RateLimiter } from '@/lib/rate-limiter';

interface RateLimitOptions {
  limit?: number;
  windowSeconds?: number;
}

export function withRateLimit(
  request: NextRequest,
  handler: () => Promise<NextResponse>,
  options: RateLimitOptions = {}
): Promise<NextResponse> {
  const limiter = RateLimiter.getInstance(options.limit, options.windowSeconds);
  
  return limiter.check(request).then(({ allowed, headers }) => {
    if (!allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
          timestamp: new Date().toISOString(),
          statusCode: 429,
        },
        {
          status: 429,
          headers: {
            ...headers,
            'Retry-After': headers['X-RateLimit-Reset'] || '60',
          },
        }
      );
    }

    return handler().then((response) => {
      // Add rate limit headers to response
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    });
  });
}