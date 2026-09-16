// app/api/cron/refresh-prices/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { prisma } from '@/lib/db/prisma';
import { priceOracle } from '@/lib/services/price-oracle.service';
import { logger } from '@/lib/logger';

/**
 * ✅ QStash-wrapped handler
 * 
 * This handler is ONLY called when:
 * 1. The request comes from QStash (verified by signature)
 * 2. The QStash token matches your project's token
 * 
 * Unauthorized requests are automatically rejected with 401.
 */
async function handler(request: NextRequest) {
  logger.info('🔄 Starting background price refresh...');

  const startTime = Date.now();

  try {
    // ============================================================
    // Step 1: Get all unique token addresses across all wallets
    // ============================================================
    const tokens = await prisma.tokenTransfer.findMany({
      distinct: ['tokenAddress'],
      select: {
        tokenAddress: true,
        chain: true,
      },
      take: 500, // ✅ Reduced to 500 to stay within API limits
    });

    logger.info(`📊 Found ${tokens.length} unique tokens to refresh`);

    if (tokens.length === 0) {
      logger.info('✅ No tokens to refresh');
      return NextResponse.json({
        success: true,
        refreshed: 0,
        total: 0,
        duration: Date.now() - startTime,
      });
    }

    // ============================================================
    // Step 2: Batch fetch prices (grouped by chain for efficiency)
    // ============================================================
    const requests = tokens
      .filter((t) => t.tokenAddress && t.chain)
      .map((t) => ({
        address: t.tokenAddress,
        chain: t.chain || 'ethereum',
      }));

    logger.info(`🔄 Fetching ${requests.length} prices...`);

    const prices = await priceOracle.getPrices(requests);

    logger.info(`✅ Refreshed ${prices.size}/${requests.length} prices`);

    // ============================================================
    // Step 3: Persist prices to database (for historical tracking)
    // ============================================================
    let savedCount = 0;
    const errors: string[] = [];

    for (const [addr, price] of prices.entries()) {
      if (!price || price <= 0) continue;

      const token = tokens.find(
        (t) => t.tokenAddress.toLowerCase() === addr.toLowerCase()
      );
      
      if (!token) continue;

      try {
        // Check if a record already exists for this token today
        const existing = await prisma.tokenPrice.findFirst({
          where: {
            tokenId: addr,
            chain: token.chain || 'ethereum',
            timestamp: {
              gte: new Date(Date.now() - 5 * 60 * 1000), // Within last 5 min
            },
          },
        });

        if (!existing) {
          await prisma.tokenPrice.create({
            data: {
              tokenId: addr,
              chain: token.chain || 'ethereum',
              priceUsd: price,
              timestamp: new Date(),
            },
          });
          savedCount++;
        }
      } catch (err) {
        // Ignore individual errors, log for debugging
        errors.push(`${addr}: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`✅ Price refresh complete: ${savedCount} saved in ${duration}ms`);

    // ============================================================
    // Step 4: Return summary
    // ============================================================
    return NextResponse.json({
      success: true,
      refreshed: prices.size,
      saved: savedCount,
      total: requests.length,
      duration,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`❌ Price refresh failed after ${duration}ms:`, error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Refresh failed',
        duration,
      },
      { status: 500 }
    );
  }
}

// ============================================================
// ✅ Export both GET and POST as QStash-verified handlers
// ============================================================
// QStash uses POST by default for scheduled jobs, but we support
// both GET (for manual testing) and POST (for QStash).
export const POST = verifySignatureAppRouter(handler);

// Optional: keep GET for manual testing (still requires valid signature)
export const GET = verifySignatureAppRouter(handler);