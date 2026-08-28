// app/api/scanner/scan/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { scannerService } from '@/lib/services/scanner.service';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      chain,
      minPnL,
      maxPnL,
      minWinRate,
      minTrades,
      minPerformance,
      maxDrawdown,
      minWalletScore,
      preferredTokens,
      preferredProtocols,
      saveAs,
      isPublic,
    } = body;

    // Build filters
    const filters: any = {};

    if (chain) filters.chain = chain;
    if (minPnL !== undefined) filters.minPnL = minPnL;
    if (maxPnL !== undefined) filters.maxPnL = maxPnL;
    if (minWinRate !== undefined) filters.minWinRate = minWinRate;
    if (minTrades !== undefined) filters.minTrades = minTrades;
    if (minPerformance !== undefined) filters.minPerformance = minPerformance;
    if (maxDrawdown !== undefined) filters.maxDrawdown = maxDrawdown;
    if (minWalletScore !== undefined) filters.minWalletScore = minWalletScore;
    if (preferredTokens?.length) filters.preferredTokens = preferredTokens;
    if (preferredProtocols?.length) filters.preferredProtocols = preferredProtocols;

    // Run scan
    const results = await scannerService.scanWallets(filters);

    // Save criteria if requested
    let savedCriteria = null;
    if (saveAs) {
      const userId = request.headers.get('x-user-id') || 'mock-user-id';
      savedCriteria = await scannerService.saveCriteria(
        userId,
        saveAs,
        filters,
        isPublic || false
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        wallets: results,
        count: results.length,
        filters,
        savedCriteria,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Scanner API error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Scan failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = request.headers.get('x-user-id') || 'mock-user-id';
    const saved = await scannerService.getSavedCriteria(userId);

    return NextResponse.json({
      success: true,
      data: saved,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch saved criteria' },
      { status: 500 }
    );
  }
}