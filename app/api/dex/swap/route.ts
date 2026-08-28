// app/api/dex/swap/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dexService } from '@/lib/services/dex.service';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      walletId,
      chain,
      fromToken,
      toToken,
      fromAmount,
      toAmount,
      dex,
      slippage,
    } = body;

    if (!walletId || !fromToken || !toToken || !fromAmount) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const result = await dexService.executeSwap(
      walletId,
      chain,
      fromToken,
      toToken,
      fromAmount,
      toAmount,
      dex,
      slippage
    );

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Swap API error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Swap failed' },
      { status: 500 }
    );
  }
}