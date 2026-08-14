// app/api/v1/portfolio/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PortfolioService } from '@/lib/services/portfolio.service';
import { validateWalletAddress, validateChain } from '@/lib/validators';
import { APIResponse } from '@/lib/types';
import { withRateLimit } from '@/lib/middleware/with-rate-limit';
import { withCache } from '@/lib/middleware/with-cache';

const portfolioService = PortfolioService.getInstance();

export async function GET(request: NextRequest) {
  return withRateLimit(request, async () => {
    return withCache(request, async () => {
      try {
        const searchParams = request.nextUrl.searchParams;
        const address = searchParams.get('address');
        const chain = searchParams.get('chain') || 'ethereum';
        const days = parseInt(searchParams.get('days') || '30');
        const interval = searchParams.get('interval') || 'daily';

        // Validate inputs
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

        // Validate days (max 365)
        if (days < 1 || days > 365) {
          return errorResponse('Days must be between 1 and 365', 400);
        }

        // Fetch portfolio history
        const history = await portfolioService.getPortfolioHistory(
          address,
          chain,
          days,
          interval as 'hourly' | 'daily' | 'weekly'
        );

        // Fetch current portfolio value
        const currentValue = await portfolioService.getCurrentPortfolioValue(
          address,
          chain
        );

        const response: APIResponse = {
          success: true,
          data: {
            history,
            currentValue,
            timeframe: {
              days,
              interval,
              startDate: history[0]?.date,
              endDate: history[history.length - 1]?.date,
            },
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
        console.error('Portfolio history error:', error);
        return errorResponse(
          error instanceof Error ? error.message : 'Internal server error',
          500
        );
      }
    }, {
      key: `portfolio:history:${searchParams.get('address')}:${searchParams.get('chain')}:${days}`,
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