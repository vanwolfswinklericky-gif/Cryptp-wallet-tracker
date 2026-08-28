// app/api/scanner/early-buyers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tokenAddress = searchParams.get('tokenAddress');
    const chain = searchParams.get('chain') || 'ETHEREUM';
    const limit = parseInt(searchParams.get('limit') || '20');
    const days = parseInt(searchParams.get('days') || '30');

    if (!tokenAddress) {
      return NextResponse.json(
        { success: false, error: 'tokenAddress is required' },
        { status: 400 }
      );
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Find wallets that bought this token early
    const wallets = await prisma.wallet.findMany({
      where: {
        isDeleted: false,
        chain: chain.toUpperCase(),
        transactions: {
          some: {
            tokenAddress,
            timestamp: { gte: startDate },
            transactionType: 'BUY',
          },
        },
      },
      include: {
        metrics: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
        transactions: {
          where: {
            tokenAddress,
            transactionType: 'BUY',
          },
          orderBy: { timestamp: 'asc' },
          take: 5,
        },
      },
      take: limit,
    });

    const results = wallets.map((wallet) => {
      const metric = wallet.metrics[0];
      const tokenTxs = wallet.transactions || [];
      const firstBuy = tokenTxs[0];
      const totalBought = tokenTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
      const avgPrice = tokenTxs.reduce((sum, tx) => sum + (tx.priceUsd || 0), 0) / (tokenTxs.length || 1);

      return {
        address: wallet.address,
        chain: wallet.chain,
        pnl: metric?.totalPnl || 0,
        roi: metric?.totalRoi || 0,
        winRate: metric?.winRate || 0,
        tradeCount: metric?.tradeCount || 0,
        walletScore: metric?.walletScore || 0,
        firstBuyDate: firstBuy?.timestamp || null,
        totalBought,
        avgPrice,
        buyCount: tokenTxs.length,
        chains: [wallet.chain],
        preferredTokens: metric?.preferredTokens || [],
      };
    });

    // Sort by earliest buy
    results.sort((a, b) => {
      if (!a.firstBuyDate) return 1;
      if (!b.firstBuyDate) return -1;
      return new Date(a.firstBuyDate).getTime() - new Date(b.firstBuyDate).getTime();
    });

    return NextResponse.json({
      success: true,
      data: {
        wallets: results,
        count: results.length,
        token: tokenAddress,
        timeframe: `${days} days`,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Early buyers error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch early buyers' },
      { status: 500 }
    );
  }
}