// app/api/scanner/whales/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chain = searchParams.get('chain') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20');
    const minVolume = parseFloat(searchParams.get('minVolume') || '100000');
    const minPnL = parseFloat(searchParams.get('minPnL') || '50000');

    // Get wallets with high volume and PnL
    const wallets = await prisma.wallet.findMany({
      where: {
        isDeleted: false,
        ...(chain && { chain: chain.toUpperCase() }),
        metrics: {
          some: {
            totalVolume: { gte: minVolume },
            totalPnl: { gte: minPnL },
            tradeCount: { gt: 50 },
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

    const results = wallets.map((wallet) => {
      const metric = wallet.metrics[0];
      
      // Whales score based on volume, PnL, and trade count
      const whaleScore = (
        (metric?.totalVolume || 0) * 0.4 +
        (metric?.totalPnl || 0) * 0.3 +
        (metric?.tradeCount || 0) * 0.3
      ) / 1000;

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
        whaleScore,
        preferredTokens: metric?.preferredTokens || [],
        preferredProtocols: metric?.preferredProtocols || [],
      };
    });

    // Sort by whale score
    results.sort((a, b) => b.whaleScore - a.whaleScore);

    return NextResponse.json({
      success: true,
      data: {
        wallets: results,
        count: results.length,
        minVolume,
        minPnL,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Whales error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch whales' },
      { status: 500 }
    );
  }
}