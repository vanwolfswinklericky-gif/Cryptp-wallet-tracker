// app/api/scanner/whales/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { WalletAnalyzer } from '@/lib/analytics/wallet-analyzer';
import { withRateLimit } from '@/lib/middleware/with-rate-limit';
import { APIResponse } from '@/lib/types';

const analyzer = WalletAnalyzer.getInstance();

export async function GET(request: NextRequest) {
  return withRateLimit(request, async () => {
    try {
      const searchParams = request.nextUrl.searchParams;
      const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;

      const results = await analyzer.getWhales(limit);
      
      const response: APIResponse = {
        success: true,
        data: {
          wallets: results,
          count: results.length,
          type: 'whales',
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
      console.error('Whales error:', error);
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
        statusCode: 500,
      }, { status: 500 });
    }
  }, {
    limit: 20,
    windowSeconds: 60,
  });
}