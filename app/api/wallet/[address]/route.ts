// app/api/wallet/[address]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { zerionService } from '@/lib/services/zerion.service';
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

// ============================================================
// TYPES
// ============================================================

interface Token {
  contractAddress: string;
  tokenName: string;
  tokenSymbol: string;
  decimals: number;
  balance: string;
  formatted?: string;
  valueUsd?: number;
}

interface WalletResponse {
  address: string;
  chain: string;
  chainName: string;
  symbol: string;
  balance: number;
  balanceFormatted: string;
  transactions: any[];
  transactionsCount: number;
  tokens: Token[];
}

// ============================================================
// VALIDATION
// ============================================================

function validateAddress(address: string, chain: string): boolean {
  if (!address || address.length < 20) return false;

  switch (chain) {
    case 'solana':
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    case 'bitcoin':
      return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address);
    default:
      // EVM address
      return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
}

// ============================================================
// MAIN HANDLER
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    // Rate limiting - 30 requests per minute per IP
    const rateLimitResult = await checkRateLimit(request);

    if (!rateLimitResult.success) {
      return createRateLimitResponse(
        rateLimitResult.limit,
        rateLimitResult.remaining,
        rateLimitResult.reset
      );
    }

    const { address } = await params;
    const searchParams = request.nextUrl.searchParams;
    const includeTxs = searchParams.get('includeTxs') === 'true';
    const chain = (searchParams.get('chain') || 'ethereum').toLowerCase();
    const cleanAddress = address.trim();

    // Validate address
    if (!validateAddress(cleanAddress, chain)) {
      return NextResponse.json(
        { error: `Invalid ${chain} address format` },
        { status: 400 }
      );
    }

    logger.info(`🔍 Fetching wallet data for ${cleanAddress} on ${chain}`);

    // ============================================================
    // ✅ ONE call for portfolio + positions
    // (getWalletPortfolio now includes positions with prices)
    // ============================================================
    const portfolio = await zerionService.getWalletPortfolio(cleanAddress);

    // ============================================================
    // ✅ Optional: Fetch transactions separately (with delay to avoid 429)
    // ============================================================
    if (includeTxs) {
      try {
        // 500ms delay to stay under Zerion's 2 req/sec rate limit
        await new Promise((resolve) => setTimeout(resolve, 500));
        
        const transactions = await zerionService.getWalletTransactions(
          cleanAddress,
          25
        );
        portfolio.transactions = transactions;
        portfolio.transactionsCount = transactions.length;
        logger.info(`✅ Fetched ${transactions.length} transactions`);
      } catch (txError) {
        logger.warn(
          '⚠️ Transaction fetch failed, continuing without them:',
          txError
        );
      }
    }

    // ============================================================
    // Build response
    // ============================================================
    const response: WalletResponse = {
      address: cleanAddress,
      chain: chain,
      chainName: chain.charAt(0).toUpperCase() + chain.slice(1),
      symbol: 'USD',
      balance: portfolio.balance,
      balanceFormatted: portfolio.balanceFormatted,
      transactions: portfolio.transactions,
      transactionsCount: portfolio.transactionsCount,
      tokens: portfolio.tokens.map((pos) => ({
        contractAddress: pos.tokenAddress,
        tokenName: pos.tokenName,
        tokenSymbol: pos.tokenSymbol,
        decimals: pos.decimals,
        balance: pos.balance,
        formatted: pos.formatted,
        valueUsd: pos.valueUsd,
      })),
    };

    logger.info(
      `✅ Wallet data ready: ${portfolio.tokens.length} tokens, ${portfolio.transactionsCount} transactions`
    );

    return NextResponse.json(response, {
      headers: rateLimitResult.headers,
    });
  } catch (error) {
    logger.error('Error fetching wallet data:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch wallet data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}