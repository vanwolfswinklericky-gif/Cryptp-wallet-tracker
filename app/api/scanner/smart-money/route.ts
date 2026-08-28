// app/api/scanner/smart-money/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chain = searchParams.get('chain') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20');

    // Get wallets with high score, low drawdown, good win rate
    const wallets = await prisma.wallet.findMany({
      where: {
        isDeleted: false,
        ...(chain && { chain: chain.toUpperCase() }),
        metrics: {
          some: {
            walletScore: { gte: 80 },
            winRate: { gte: 55 },
            maxDrawdown: { lte: 20 },
            tradeCount: { gte: 20 },
            totalRoi: { gt: 0 },
          },
        },
      },
      include: {
        metrics: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
      take: limit,
    });

    // Calculate smart money score
    const results = wallets.map((wallet) => {
      const metric = wallet.metrics[0];
      
      // Smart money score combines multiple metrics
      const smartScore = (
        (metric?.walletScore || 0) * 0.3 +
        (metric?.winRate || 0) * 0.2 +
        (100 - (metric?.maxDrawdown || 0)) * 0.2 +
        (metric?.totalRoi || 0) * 0.15 +
        (metric?.consistencyScore || 0) * 0.15
      );

      return {
        address: wallet.address,
        chain: wallet.chain,
        pnl: metric?.totalPnl || 0,
        roi: metric?.totalRoi || 0,
        winRate: metric?.winRate || 0,
        tradeCount: metric?.tradeCount || 0,
        averageTrade: metric?.averageTrade || 0,
        volume: metric?.totalVolume || 0,
        drawdown: metric?.maxDrawdown || 0,
        walletScore: metric?.walletScore || 0,
        consistencyScore: metric?.consistencyScore || 0,
        smartScore,
        chains: [wallet.chain],
        preferredTokens: metric?.preferredTokens || [],
        preferredProtocols: metric?.preferredProtocols || [],
      };
    });

    // Sort by smart score
    results.sort((a, b) => b.smartScore - a.smartScore);

    return NextResponse.json({
      success: true,
      data: {
        wallets: results,
        count: results.length,
        criteria: '80+ Score, 55%+ Win Rate, <20% Drawdown, 20+ Trades',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Smart money error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch smart money wallets' },
      { status: 500 }
    );
  }
}