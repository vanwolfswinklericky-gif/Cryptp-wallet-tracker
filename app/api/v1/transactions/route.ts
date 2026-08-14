// app/api/v1/transactions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { TransactionService } from '@/lib/services/transaction.service';
import { validateWalletAddress, validateChain, validateLimit, validateOffset } from '@/lib/validators';
import { APIResponse } from '@/lib/types';
import { withRateLimit } from '@/lib/middleware/with-rate-limit';
import { withCache } from '@/lib/middleware/with-cache';

const transactionService = TransactionService.getInstance();

export async function GET(request: NextRequest) {
  return withRateLimit(request, async () => {
    return withCache(request, async () => {
      try {
        const searchParams = request.nextUrl.searchParams;
        const address = searchParams.get('address');
        const chain = searchParams.get('chain') || 'ethereum';
        const limit = searchParams.get('limit') || '50';
        const offset = searchParams.get('offset') || '0';
        const type = searchParams.get('type');
        const startBlock = searchParams.get('startBlock');
        const endBlock = searchParams.get('endBlock');

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

        const limitValidation = validateLimit(limit);
        if (!limitValidation.valid) {
          return errorResponse(limitValidation.error || 'Invalid limit', 400);
        }

        const offsetValidation = validateOffset(offset);
        if (!offsetValidation.valid) {
          return errorResponse(offsetValidation.error || 'Invalid offset', 400);
        }

        // Fetch transactions with filters
        const result = await transactionService.getTransactions(
          address,
          chain,
          {
            limit: limitValidation.value,
            offset: offsetValidation.value,
            type: type as 'incoming' | 'outgoing' | 'all' | undefined,
            startBlock: startBlock ? parseInt(startBlock) : undefined,
            endBlock: endBlock ? parseInt(endBlock) : undefined,
          }
        );

        // Get transaction stats
        const stats = await transactionService.getTransactionStats(address, chain);

        const response: APIResponse = {
          success: true,
          data: {
            transactions: result.transactions,
            stats,
            pagination: {
              page: Math.floor(offsetValidation.value / limitValidation.value) + 1,
              limit: limitValidation.value,
              total: result.total,
              hasMore: result.hasMore,
            },
          },
          timestamp: new Date().toISOString(),
          statusCode: 200,
        };

        return NextResponse.json(response, {
          status: 200,
          headers: {
            'Cache-Control': 's-maxage=30, stale-while-revalidate=15',
          },
        });
      } catch (error) {
        console.error('Transaction error:', error);
        return errorResponse(
          error instanceof Error ? error.message : 'Internal server error',
          500
        );
      }
    }, {
      key: `transactions:${searchParams.get('address')}:${searchParams.get('chain')}:${searchParams.get('limit')}:${searchParams.get('offset')}`,
      ttl: 30,
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