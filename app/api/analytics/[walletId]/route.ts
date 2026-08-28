// app/api/analytics/[walletId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { walletAnalytics } from '@/lib/analytics/wallet-analytics.service';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { walletId: string } }
) {
  try {
    const { walletId } = await params;

    if (!walletId) {
      return NextResponse.json(
        { success: false, error: 'Wallet ID is required' },
        { status: 400 }
      );
    }

    const analytics = await walletAnalytics.calculateAnalytics(walletId);

    if (!analytics) {
      return NextResponse.json(
        { success: false, error: 'Wallet not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: analytics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Analytics API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to calculate analytics' },
      { status: 500 }
    );
  }
}