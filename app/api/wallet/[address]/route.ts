import { NextRequest, NextResponse } from 'next/server';
import { 
  getNativeBalance, 
  getTransactions, 
  getTokenTransferHistory,
  CHAIN_NAMES,
  CHAIN_SYMBOLS,
  type ChainName
} from '@/lib/etherscan';
import { 
  getBitcoinBalance, 
  getBitcoinTransactions,
  getSolanaBalance,
  getSolanaTransactions,
  validateAddress
} from '@/lib/blockchain';
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit';
import { tokenBalanceService } from '@/lib/services/token-balance.service';
import { logger } from '@/lib/logger';

// ============================================================
// TYPES
// ============================================================

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp?: string;
  blockNumber?: string;
  [key: string]: any;
}

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
  transactions: Transaction[];
  transactionsCount: number;
  tokens: Token[];
}

interface ErrorResponse {
  error: string;
  details?: string;
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
    const chain = (searchParams.get('chain') || 'ethereum') as ChainName;
    const cleanAddress = address.trim();

    // Validate address based on chain
    if (!validateAddress(cleanAddress, chain)) {
      return NextResponse.json(
        { error: `Invalid ${chain} address format` },
        { status: 400 }
      );
    }

    // Route to appropriate chain handler
    let response: WalletResponse;

    switch (chain) {
      case 'bitcoin':
        response = await handleBitcoin(cleanAddress, includeTxs);
        break;
      case 'solana':
        response = await handleSolana(cleanAddress, includeTxs);
        break;
      default:
        response = await handleEVMChain(cleanAddress, chain, includeTxs);
    }

    return NextResponse.json(response, { 
      headers: rateLimitResult.headers 
    });

  } catch (error) {
    logger.error('Error fetching wallet data:', error);
    
    const errorResponse: ErrorResponse = {
      error: 'Failed to fetch wallet data',
      details: error instanceof Error ? error.message : 'Unknown error'
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// ============================================================
// CHAIN HANDLERS
// ============================================================

async function handleBitcoin(
  address: string, 
  includeTxs: boolean
): Promise<WalletResponse> {
  try {
    const balance = await getBitcoinBalance(address);
    
    const response: WalletResponse = {
      address,
      chain: 'bitcoin',
      chainName: 'Bitcoin',
      symbol: 'BTC',
      balance,
      balanceFormatted: balance.toFixed(8),
      transactions: [],
      transactionsCount: 0,
      tokens: [],
    };

    if (includeTxs) {
      const transactions = await getBitcoinTransactions(address, 10);
      response.transactions = transactions;
      response.transactionsCount = transactions.length;
    }

    return response;
  } catch (error) {
    logger.error('Bitcoin API error:', error);
    throw new Error(
      `Failed to fetch Bitcoin data: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function handleSolana(
  address: string, 
  includeTxs: boolean
): Promise<WalletResponse> {
  try {
    const balance = await getSolanaBalance(address);
    
    const response: WalletResponse = {
      address,
      chain: 'solana',
      chainName: 'Solana',
      symbol: 'SOL',
      balance,
      balanceFormatted: balance.toFixed(6),
      transactions: [],
      transactionsCount: 0,
      tokens: [],
    };

    if (includeTxs) {
      const transactions = await getSolanaTransactions(address, 10);
      response.transactions = transactions;
      response.transactionsCount = transactions.length;
    }

    return response;
  } catch (error) {
    logger.error('Solana API error:', error);
    throw new Error(
      `Failed to fetch Solana data: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function handleEVMChain(
  address: string,
  chain: ChainName,
  includeTxs: boolean
): Promise<WalletResponse> {
  const chainName = CHAIN_NAMES[chain] || chain;
  const symbol = CHAIN_SYMBOLS[chain] || 'ETH';

  // ============================================================
  // 1. Fetch native balance (still from Etherscan — this works)
  // ============================================================
  logger.info(`🔍 Fetching balance for ${chain}...`);
  const balanceResponse = await getNativeBalance(address, chain);
  
  logger.info(`📊 Raw balance response for ${chain}:`, {
    status: balanceResponse.status,
    message: balanceResponse.message,
    result: balanceResponse.result,
  });

  if (balanceResponse.status !== '1') {
    logger.warn(`⚠️ Balance API returned error for ${chain}:`, balanceResponse.message);
    throw new Error(`Balance API error: ${balanceResponse.message || 'Unknown error'}`);
  }

  const balanceInWei = balanceResponse.result;
  const balance = parseFloat(balanceInWei) / 1e18;

  // Build base response
  const response: WalletResponse = {
    address,
    chain,
    chainName,
    symbol,
    balance,
    balanceFormatted: balance.toFixed(6),
    transactions: [],
    transactionsCount: 0,
    tokens: [],
  };

  // Skip additional data if not requested
  if (!includeTxs) {
    return response;
  }

  // ============================================================
  // 2. Fetch transactions (from Etherscan — still works)
  // ============================================================
  await fetchTransactions(address, chain, response);

  // ============================================================
  // 3. Fetch token balances (NEW: Direct RPC — the fix!)
  // ============================================================
  await fetchTokenBalancesDirect(address, chain, response);

  return response;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

async function fetchTransactions(
  address: string,
  chain: ChainName,
  response: WalletResponse
): Promise<void> {
  try {
    logger.info(`🔍 Fetching transactions for ${chain}...`);
    const txResponse = await getTransactions(address, 1, 10, chain);
    
    if (txResponse.status === '1') {
      response.transactions = txResponse.result;
      response.transactionsCount = txResponse.result.length;
      logger.info(`✅ Found ${response.transactionsCount} transactions`);
    } else {
      logger.info(`ℹ️ No transactions found for ${chain}: ${txResponse.message}`);
    }
  } catch (error) {
    logger.error(`❌ Error fetching transactions for ${chain}:`, error);
    // Don't throw - transactions are optional
  }
}

/**
 * ✅ NEW: Fetch token balances using DIRECT CONTRACT CALLS
 * 
 * This replaces the old Etherscan-based token fetching that was failing
 * with NOTOK status. Now we:
 *   1. Discover which tokens the wallet has interacted with (via Etherscan transfer history)
 *   2. Check each token balance DIRECTLY via RPC (no API key needed, no NOTOK errors)
 */
async function fetchTokenBalancesDirect(
  address: string,
  chain: ChainName,
  response: WalletResponse
): Promise<void> {
  try {
    logger.info(`🔍 Fetching token balances for ${chain}...`);

    // Step 1: Discover token addresses the wallet has interacted with
    const tokenAddresses = await discoverTokenAddresses(address, chain);
    
    if (tokenAddresses.length === 0) {
      logger.info(`ℹ️ No token interactions found for ${chain}`);
      response.tokens = [];
      return;
    }

    logger.info(`📊 Discovered ${tokenAddresses.length} potential token contracts`);

    // Step 2: Fetch actual balances via direct RPC calls
    const balances = await tokenBalanceService.getTokenBalances(
      tokenAddresses,
      address,
      chain
    );

    // Step 3: Map to response format
    response.tokens = balances.map((b) => ({
      contractAddress: b.tokenAddress,
      tokenName: b.tokenName,
      tokenSymbol: b.tokenSymbol,
      decimals: b.decimals,
      balance: b.balance,
      formatted: b.formatted,
    }));

    logger.info(`✅ Found ${response.tokens.length} tokens with balance`);

  } catch (error) {
    logger.error(`❌ Error fetching token balances for ${chain}:`, error);
    response.tokens = [];
  }
}

/**
 * ✅ Discover token addresses from Etherscan token transfer history
 * 
 * This uses Etherscan for what it's GOOD at (indexing historical transfers)
 * but not for BALANCE lookups (which we do via direct RPC).
 */
async function discoverTokenAddresses(
  address: string,
  chain: ChainName
): Promise<string[]> {
  try {
    const { getTokenTransferHistory } = await import('@/lib/etherscan');
    const transferHistory = await getTokenTransferHistory(address, chain);
    
    if (!transferHistory || transferHistory.status !== '1' || !Array.isArray(transferHistory.result)) {
      logger.warn(`⚠️ Could not fetch token transfer history for ${chain}`);
      return [];
    }

    // Extract unique contract addresses
    const uniqueContracts = new Set<string>();
    transferHistory.result.forEach((tx: any) => {
      if (tx.contractAddress) {
        uniqueContracts.add(tx.contractAddress.toLowerCase());
      }
    });

    logger.info(`📊 Found ${uniqueContracts.size} unique token contracts from history`);
    return Array.from(uniqueContracts);

  } catch (error) {
    logger.error(`❌ Error discovering tokens:`, error);
    return [];
  }
}