// app/api/cron/refresh-prices/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { priceOracle } from '@/lib/services/price-oracle.service';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel passes this header)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  logger.info('🔄 Starting background price refresh...');

  try {
    // Get all unique token addresses across all wallets
    const tokens = await prisma.tokenTransfer.findMany({
      distinct: ['tokenAddress'],
      select: {
        tokenAddress: true,
        chain: true,
      },
      take: 1000, // Limit per run to stay within rate limits
    });

    logger.info(`📊 Refreshing prices for ${tokens.length} tokens`);

    // Batch fetch prices
    const requests = tokens.map(t => ({
      address: t.tokenAddress,
      chain: t.chain || 'ethereum',
    }));

    const prices = await priceOracle.getPrices(requests);

    logger.info(`✅ Refreshed ${prices.size} prices`);

    // Update token price records in DB
    for (const [addr, price] of prices.entries()) {
      const token = tokens.find(t => t.tokenAddress.toLowerCase() === addr);
      if (!token) continue;

      await prisma.tokenPrice.create({
        data: {
          tokenId: addr,
          chain: token.chain || 'ethereum',
          priceUsd: price,
          timestamp: new Date(),
        },
      }).catch(() => {}); // Ignore duplicates
    }

    return NextResponse.json({
      success: true,
      refreshed: prices.size,
      total: tokens.length,
    });
  } catch (error) {
    logger.error('Price refresh failed:', error);
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 });
  }
}