// app/api/scanner/top-performers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chain = searchParams.get('chain') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20');
    const timeframe = searchParams.get('timeframe') || '90d';

    // Map timeframe to field
    const performanceField = {
      '24h': 'performance24h',
      '7d': 'performance7d',
      '30d': 'performance30d',
      '90d': 'performance90d',
    }[timeframe] || 'performance90d';

    // Get wallets with best performance
    const wallets = await prisma.wallet.findMany({
      where: {
        isDeleted: false,
        ...(chain && { chain: chain.toUpperCase() }),
        metrics: {
          some: {
            // At least some trades
            tradeCount: { gt: 10 },
          },
        },
      },
      include: {
        metrics: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
      take: limit * 2, // Fetch more, filter later
    });

    // Filter and sort by performance
    const results = wallets
      .map((wallet) => {
        const metric = wallet.metrics[0];
        if (!metric) return null;

        const performance = metric[performanceField as keyof typeof metric] as number || 0;
        const roi = metric.totalRoi || 0;
        const winRate = metric.winRate || 0;

        // Performance score combines ROI, win rate, and performance
        const performanceScore = (performance * 0.4) + (roi * 0.3) + (winRate * 0.3);

        return {
          address: wallet.address,
          chain: wallet.chain,
          pnl: metric.totalPnl || 0,
          roi: metric.totalRoi || 0,
          winRate: metric.winRate || 0,
          tradeCount: metric.tradeCount || 0,
          averageTrade: metric.averageTrade || 0,
          volume: metric.totalVolume || 0,
          drawdown: metric.maxDrawdown || 0,
          walletScore: metric.walletScore || 0,
          performance: performance,
          performanceScore,
          chains: [wallet.chain],
          preferredTokens: metric.preferredTokens || [],
          preferredProtocols: metric.preferredProtocols || [],
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b?.performanceScore || 0) - (a?.performanceScore || 0))
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        wallets: results,
        count: results.length,
        timeframe,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Top performers error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch top performers' },
      { status: 500 }
    );
  }
}