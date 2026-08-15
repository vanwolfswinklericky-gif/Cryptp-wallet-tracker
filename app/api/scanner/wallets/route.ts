// app/api/scanner/wallets/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { WalletAnalyzer, ScannerFilters } from '@/lib/analytics/wallet-analyzer';
import { withRateLimit } from '@/lib/middleware/with-rate-limit';
import { withCache } from '@/lib/middleware/with-cache';
import { APIResponse } from '@/lib/types';

const analyzer = WalletAnalyzer.getInstance();

export async function GET(request: NextRequest) {
  return withRateLimit(request, async () => {
    return withCache(request, async () => {
      try {
        const searchParams = request.nextUrl.searchParams;
        
        // Parse filters
        const filters: ScannerFilters = {
          minPnL: searchParams.get('minPnL') ? parseFloat(searchParams.get('minPnL')!) : undefined,
          maxPnL: searchParams.get('maxPnL') ? parseFloat(searchParams.get('maxPnL')!) : undefined,
          minWinRate: searchParams.get('minWinRate') ? parseFloat(searchParams.get('minWinRate')!) : undefined,
          minTrades: searchParams.get('minTrades') ? parseInt(searchParams.get('minTrades')!) : undefined,
          minPerformance: searchParams.get('minPerformance') ? parseFloat(searchParams.get('minPerformance')!) : undefined,
          maxDrawdown: searchParams.get('maxDrawdown') ? parseFloat(searchParams.get('maxDrawdown')!) : undefined,
          minWalletScore: searchParams.get('minWalletScore') ? parseInt(searchParams.get('minWalletScore')!) : undefined,
          chains: searchParams.get('chains') ? searchParams.get('chains')!.split(',') : undefined,
          tokens: searchParams.get('tokens') ? searchParams.get('tokens')!.split(',') : undefined,
          protocols: searchParams.get('protocols') ? searchParams.get('protocols')!.split(',') : undefined,
        };

        const results = await analyzer.scanWallets(filters);
        
        const response: APIResponse = {
          success: true,
          data: {
            wallets: results,
            count: results.length,
            filters,
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
        console.error('Scanner error:', error);
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
          timestamp: new Date().toISOString(),
          statusCode: 500,
        }, { status: 500 });
      }
    }, {
      key: `scanner:wallets:${request.url}`,
      ttl: 60,
    });
  }, {
    limit: 20,
    windowSeconds: 60,
  });
}