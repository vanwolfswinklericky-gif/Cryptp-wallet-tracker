import { NextRequest, NextResponse } from 'next/server';
import { 
  getNativeBalance, 
  getTransactions, 
  getTokenBalances,
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
    console.error('Error fetching wallet data:', error);
    
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
    console.error('Bitcoin API error:', error);
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
    console.error('Solana API error:', error);
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

  // Fetch native balance
  console.log(`🔍 Fetching balance for ${chain}...`);
  const balanceResponse = await getNativeBalance(address, chain);
  
  // Log raw response for debugging
  console.log(`📊 Raw balance response for ${chain}:`, {
    status: balanceResponse.status,
    message: balanceResponse.message,
    result: balanceResponse.result,
  });

  if (balanceResponse.status !== '1') {
    console.warn(`⚠️ Balance API returned error for ${chain}:`, balanceResponse.message);
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

  // Fetch transactions (optional)
  await fetchTransactions(address, chain, response);

  // Fetch token balances (optional)
  await fetchTokenBalances(address, chain, response);

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
    console.log(`🔍 Fetching transactions for ${chain}...`);
    const txResponse = await getTransactions(address, 1, 10, chain);
    
    if (txResponse.status === '1') {
      response.transactions = txResponse.result;
      response.transactionsCount = txResponse.result.length;
      console.log(`✅ Found ${response.transactionsCount} transactions`);
    } else {
      console.log(`ℹ️ No transactions found for ${chain}:`, txResponse.message);
    }
  } catch (error) {
    console.error(`❌ Error fetching transactions for ${chain}:`, error);
    // Don't throw - transactions are optional
  }
}

async function fetchTokenBalances(
  address: string,
  chain: ChainName,
  response: WalletResponse
): Promise<void> {
  try {
    console.log(`🔍 Fetching token balances for ${chain}...`);
    const tokenResult = await getTokenBalances(address, chain);
    
    // Check if the response is successful and has valid data
    if (tokenResult?.status === '1' && Array.isArray(tokenResult.result)) {
      // Filter out invalid tokens and map to clean structure
      const validTokens = tokenResult.result
        .filter((token: any) => token && typeof token === 'object')
        .slice(0, 20)
        .map((token: any) => ({
          contractAddress: token.contractAddress || '0x0',
          tokenName: token.tokenName || 'Unknown Token',
          tokenSymbol: token.tokenSymbol || 'UNKNOWN',
          decimals: parseInt(token.tokenDecimal) || 18,
          balance: token.balance || '0',
        }));
      
      response.tokens = validTokens;
      console.log(`✅ Found ${response.tokens.length} tokens with balance`);
    } else {
      // Handle different error states
      if (tokenResult?.message) {
        console.log(`ℹ️ No token balances found: ${tokenResult.message}`);
      } else {
        console.log(`ℹ️ No token balances found for ${chain}`);
      }
      response.tokens = [];
    }
  } catch (tokenError) {
    console.error(`❌ Error fetching token balances for ${chain}:`, tokenError);
    response.tokens = [];
  }
}