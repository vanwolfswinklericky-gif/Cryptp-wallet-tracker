// app/api/v1/defi/positions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { DeFiService } from '@/lib/services/defi.service';
import { validateWalletAddress, validateChain } from '@/lib/validators';
import { APIResponse } from '@/lib/types';
import { withRateLimit } from '@/lib/middleware/with-rate-limit';
import { withCache } from '@/lib/middleware/with-cache';

const defiService = DeFiService.getInstance();

export async function GET(request: NextRequest) {
  return withRateLimit(request, async () => {
    return withCache(request, async () => {
      try {
        const searchParams = request.nextUrl.searchParams;
        const address = searchParams.get('address');
        const chain = searchParams.get('chain') || 'ethereum';
        const protocol = searchParams.get('protocol');

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

        // Fetch DeFi positions
        const positions = await defiService.getDeFiPositions(
          address,
          chain,
          protocol || undefined
        );

        const summary = defiService.calculatePositionSummary(positions);

        const response: APIResponse = {
          success: true,
          data: {
            positions,
            summary,
            totalValueLocked: summary.totalValue,
            protocols: summary.protocols,
            address,
            chain,
          },
          timestamp: new Date().toISOString(),
          statusCode: 200,
        };

        return NextResponse.json(response, {
          status: 200,
          headers: {
            'Cache-Control': 's-maxage=120, stale-while-revalidate=60',
          },
        });
      } catch (error) {
        console.error('DeFi positions error:', error);
        return errorResponse(
          error instanceof Error ? error.message : 'Internal server error',
          500
        );
      }
    }, {
      key: `defi:positions:${searchParams.get('address')}:${searchParams.get('chain')}:${searchParams.get('protocol') || 'all'}`,
      ttl: 120,
    });
  }, {
    limit: 20,
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