// app/api/scanner/wallets/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Parse filters
    const chain = searchParams.get('chain') || undefined;
    const minPnL = searchParams.get('minPnL') ? parseFloat(searchParams.get('minPnL')!) : undefined;
    const maxPnL = searchParams.get('maxPnL') ? parseFloat(searchParams.get('maxPnL')!) : undefined;
    const minWinRate = searchParams.get('minWinRate') ? parseFloat(searchParams.get('minWinRate')!) : undefined;
    const minTrades = searchParams.get('minTrades') ? parseInt(searchParams.get('minTrades')!) : undefined;
    const minPerformance = searchParams.get('minPerformance') ? parseFloat(searchParams.get('minPerformance')!) : undefined;
    const maxDrawdown = searchParams.get('maxDrawdown') ? parseFloat(searchParams.get('maxDrawdown')!) : undefined;
    const minWalletScore = searchParams.get('minWalletScore') ? parseInt(searchParams.get('minWalletScore')!) : undefined;
    const preferredTokens = searchParams.get('tokens')?.split(',') || undefined;
    const preferredProtocols = searchParams.get('protocols')?.split(',') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50');
    const sortBy = searchParams.get('sortBy') || 'walletScore';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build where clause
    const where: any = {
      isDeleted: false,
      metrics: {
        some: {},
      },
    };

    if (chain) {
      where.chain = chain.toUpperCase();
    }

    // Build metric filters
    const metricFilters: any = {};
    if (minPnL !== undefined) metricFilters.totalPnl = { gte: minPnL };
    if (maxPnL !== undefined) metricFilters.totalPnl = { ...metricFilters.totalPnl, lte: maxPnL };
    if (minWinRate !== undefined) metricFilters.winRate = { gte: minWinRate };
    if (minTrades !== undefined) metricFilters.tradeCount = { gte: minTrades };
    if (minPerformance !== undefined) metricFilters.performance90d = { gte: minPerformance };
    if (maxDrawdown !== undefined) metricFilters.maxDrawdown = { lte: maxDrawdown };
    if (minWalletScore !== undefined) metricFilters.walletScore = { gte: minWalletScore };

    if (Object.keys(metricFilters).length > 0) {
      where.metrics = { some: metricFilters };
    }

    // Fetch wallets
    const wallets = await prisma.wallet.findMany({
      where,
      include: {
        metrics: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
        transactions: {
          take: 100,
          orderBy: { timestamp: 'desc' },
        },
      },
      take: limit,
    });

    // Transform results
    const results = wallets.map((wallet) => {
      const metric = wallet.metrics[0];
      const matchedFilters: string[] = [];
      
      if (metric) {
        if (minPnL && metric.totalPnl >= minPnL) matchedFilters.push(`PnL > $${minPnL.toLocaleString()}`);
        if (minWinRate && metric.winRate >= minWinRate) matchedFilters.push(`Win Rate > ${minWinRate}%`);
        if (minTrades && metric.tradeCount >= minTrades) matchedFilters.push(`${minTrades}+ Trades`);
        if (minPerformance && metric.performance90d >= minPerformance) matchedFilters.push(`Performance > ${minPerformance}%`);
        if (maxDrawdown && metric.maxDrawdown <= maxDrawdown) matchedFilters.push(`Drawdown < ${maxDrawdown}%`);
        if (minWalletScore && metric.walletScore >= minWalletScore) matchedFilters.push(`Score > ${minWalletScore}`);
      }

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
        chains: [wallet.chain],
        preferredTokens: metric?.preferredTokens || [],
        preferredProtocols: metric?.preferredProtocols || [],
        matchedFilters,
      };
    });

    // Sort results
    const sorted = results.sort((a, b) => {
      const aVal = a[sortBy as keyof typeof a] || 0;
      const bVal = b[sortBy as keyof typeof b] || 0;
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return NextResponse.json({
      success: true,
      data: {
        wallets: sorted,
        count: sorted.length,
        filters: { chain, minPnL, maxPnL, minWinRate, minTrades, minPerformance, maxDrawdown, minWalletScore },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Scanner wallets error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to scan wallets' },
      { status: 500 }
    );
  }
}