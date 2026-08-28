// app/api/dex/quote/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dexService } from '@/lib/services/dex.service';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chain = searchParams.get('chain') || 'ETHEREUM';
    const fromToken = searchParams.get('fromToken');
    const toToken = searchParams.get('toToken');
    const amount = parseFloat(searchParams.get('amount') || '0');
    const slippage = parseFloat(searchParams.get('slippage') || '0.5');

    if (!fromToken || !toToken || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const quote = await dexService.getQuote(chain, fromToken, toToken, amount, slippage);

    if (!quote) {
      return NextResponse.json(
        { success: false, error: 'No route found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: quote,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Quote API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get quote' },
      { status: 500 }
    );
  }
}