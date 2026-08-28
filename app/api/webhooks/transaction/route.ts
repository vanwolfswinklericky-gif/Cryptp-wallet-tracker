// app/api/webhooks/transaction/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { copyTradingService } from '@/lib/services/copy-trading.service';
import { logger } from '@/lib/logger';

// ✅ This endpoint is called by your blockchain monitoring system
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, transaction } = body;

    if (!walletAddress || !transaction) {
      return NextResponse.json(
        { success: false, error: 'Missing walletAddress or transaction' },
        { status: 400 }
      );
    }

    // Process the transaction and send webhooks
    await copyTradingService.processTransaction(walletAddress, transaction);

    return NextResponse.json({
      success: true,
      message: 'Transaction processed',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Transaction webhook error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process transaction' },
      { status: 500 }
    );
  }
}