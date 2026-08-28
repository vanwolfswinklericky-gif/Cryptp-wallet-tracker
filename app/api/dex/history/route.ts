// app/api/dex/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dexService } from '@/lib/services/dex.service';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const walletId = searchParams.get('walletId');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!walletId) {
      return NextResponse.json(
        { success: false, error: 'Missing walletId' },
        { status: 400 }
      );
    }

    const history = await dexService.getTradeHistory(walletId, limit);

    return NextResponse.json({
      success: true,
      data: history,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Trade history API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch trade history' },
      { status: 500 }
    );
  }
}