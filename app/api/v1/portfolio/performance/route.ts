// app/api/v1/portfolio/performance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AnalyticsService } from '@/lib/services/analytics.service';
import { validateWalletAddress, validateChain } from '@/lib/validators';
import { APIResponse } from '@/lib/types';
import { withRateLimit } from '@/lib/middleware/with-rate-limit';
import { withCache } from '@/lib/middleware/with-cache';

const analyticsService = AnalyticsService.getInstance();

export async function GET(request: NextRequest) {
  return withRateLimit(request, async () => {
    return withCache(request, async () => {
      try {
        const searchParams = request.nextUrl.searchParams;
        const address = searchParams.get('address');
        const chain = searchParams.get('chain') || 'ethereum';
        const period = searchParams.get('period') || '30d';

        if (!address) {
          return errorResponse('Wallet address is required', 400);
        }

        const addressValidation = validateWalletAddress(address);
        if (!addressValidation.valid) {
          return errorResponse(addressValidation.error || 'Invalid address', 400);
        }

        const chainValidation = validateChain(chain);
        if (!chainValidation.valid) {
          return errorResponse(chainValidation.error || 'Invalid chain', 400);
        }

        // Fetch performance metrics
        const performance = await analyticsService.getPortfolioPerformance(
          address,
          chain,
          period as '24h' | '7d' | '30d' | '90d' | '1y'
        );

        const response: APIResponse = {
          success: true,
          data: {
            ...performance,
            address,
            chain,
            period,
          },
          timestamp: new Date().toISOString(),
          statusCode: 200,
        };

        return NextResponse.json(response, {
          status: 200,
          headers: {
            'Cache-Control': 's-maxage=60, stale-while-revalidate=30',
          },
        });
      } catch (error) {
        console.error('Performance error:', error);
        return errorResponse(
          error instanceof Error ? error.message : 'Internal server error',
          500
        );
      }
    }, {
      key: `portfolio:performance:${searchParams.get('address')}:${searchParams.get('chain')}:${period}`,
      ttl: 60,
    });
  }, {
    limit: 30,
    windowSeconds: 60,
  });
}

function errorResponse(error: string, statusCode: number = 400): NextResponse {
  const response: APIResponse = {
    success: false,
    error,
    timestamp: new Date().toISOString(),
    statusCode,
  };
  return NextResponse.json(response, { status: statusCode });
}
