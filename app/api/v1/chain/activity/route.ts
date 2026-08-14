// app/api/v1/chain/activity/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ChainService } from '@/lib/services/chain.service';
import { validateWalletAddress, validateChain } from '@/lib/validators';
import { APIResponse } from '@/lib/types';
import { withRateLimit } from '@/lib/middleware/with-rate-limit';
import { withCache } from '@/lib/middleware/with-cache';

const chainService = ChainService.getInstance();

export async function GET(request: NextRequest) {
  return withRateLimit(request, async () => {
    return withCache(request, async () => {
      try {
        const searchParams = request.nextUrl.searchParams;
        const address = searchParams.get('address');
        const chain = searchParams.get('chain') || 'ethereum';

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

        // Fetch chain activity
        const activity = await chainService.getChainActivity(
          address,
          chain
        );

        const response: APIResponse = {
          success: true,
          data: {
            ...activity,
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
        console.error('Chain activity error:', error);
        return errorResponse(
          error instanceof Error ? error.message : 'Internal server error',
          500
        );
      }
    }, {
      key: `chain:activity:${searchParams.get('address')}:${searchParams.get('chain')}`,
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