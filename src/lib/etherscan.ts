import axios from 'axios';

const BASE_URL = 'https://api.etherscan.io/v2/api';
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

// Chain IDs for V2
export const CHAIN_IDS = {
  ethereum: 1,
  polygon: 137,
  bsc: 56,
  arbitrum: 42161,
  optimism: 10,
  avalanche: 43114,
  base: 8453,
  solana: 'solana',
  bitcoin: 'bitcoin',
} as const;

export type ChainId = typeof CHAIN_IDS[keyof typeof CHAIN_IDS];
export type ChainName = keyof typeof CHAIN_IDS;

export const CHAIN_NAMES: Record<ChainName, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  bsc: 'BNB Smart Chain',
  arbitrum: 'Arbitrum',
  optimism: 'Optimism',
  avalanche: 'Avalanche',
  base: 'Base',
  solana: 'Solana',
  bitcoin: 'Bitcoin',
};

export const CHAIN_SYMBOLS: Record<ChainName, string> = {
  ethereum: 'ETH',
  polygon: 'MATIC',
  bsc: 'BNB',
  arbitrum: 'ETH',
  optimism: 'ETH',
  avalanche: 'AVAX',
  base: 'ETH',
  solana: 'SOL',
  bitcoin: 'BTC',
};

export const CHAIN_EXPLORERS: Record<ChainName, string> = {
  ethereum: 'https://etherscan.io',
  polygon: 'https://polygonscan.com',
  bsc: 'https://bscscan.com',
  arbitrum: 'https://arbiscan.io',
  optimism: 'https://optimistic.etherscan.io',
  avalanche: 'https://snowtrace.io',
  base: 'https://basescan.org',
  solana: 'https://solscan.io',
  bitcoin: 'https://blockchair.com/bitcoin',
};

// ✅ EXPORT CHAIN_OPTIONS
export const CHAIN_OPTIONS = Object.entries(CHAIN_NAMES).map(([key, name]) => ({
  value: key,
  label: `${name} (${CHAIN_SYMBOLS[key as ChainName]})`,
}));

// Get chain ID from name
export function getChainId(chain: ChainName): number {
  return CHAIN_IDS[chain] || CHAIN_IDS.ethereum;
}

// ============================================================
// NATIVE BALANCE
// ============================================================

// Native balance for any chain
export async function getNativeBalance(address: string, chain: ChainName = 'ethereum') {
  const chainId = getChainId(chain);
  const response = await axios.get(BASE_URL, {
    params: {
      chainid: chainId,
      module: 'account',
      action: 'balance',
      address: address,
      tag: 'latest',
      apikey: ETHERSCAN_API_KEY
    }
  });
  return response.data;
}

// ============================================================
// TOKEN BALANCES (with batching and better error handling)
// ============================================================

/**
 * Get all token balances for a wallet
 * Uses batching to avoid rate limiting
 */
export async function getTokenBalances(
  address: string,
  chain: ChainName = 'ethereum'
) {
  const chainId = getChainId(chain);
  
  try {
    console.log(`🔍 Fetching token balances for ${address} on ${chain}...`);
    
    // First, get all token transfers to find token contracts
    const transfersResponse = await axios.get(BASE_URL, {
      params: {
        chainid: chainId,
        module: 'account',
        action: 'tokentx',
        address: address,
        startblock: 0,
        endblock: 99999999,
        sort: 'desc',
        apikey: ETHERSCAN_API_KEY
      }
    });

    if (transfersResponse.data.status !== '1') {
      console.log(`ℹ️ No token transfers found for ${address}`);
      return { status: '0', message: 'No token transfers found', result: [] };
    }

    const transfers = transfersResponse.data.result;
    
    // Get unique token contracts from transfers
    const uniqueContracts = new Map();

    transfers.forEach((transfer: any) => {
      const contractAddress = transfer.contractAddress;
      if (!uniqueContracts.has(contractAddress)) {
        uniqueContracts.set(contractAddress, {
          contractAddress: contractAddress,
          tokenName: transfer.tokenName || 'Unknown',
          tokenSymbol: transfer.tokenSymbol || 'UNKNOWN',
          tokenDecimal: parseInt(transfer.tokenDecimal) || 18,
          balance: '0',
        });
      }
    });

    const tokenList = Array.from(uniqueContracts.values());
    console.log(`📊 Found ${tokenList.length} unique token contracts`);

    // ✅ BATCH the requests to avoid rate limiting
    // Process in batches of 5 with delays between batches
    const BATCH_SIZE = 5;
    const DELAY_MS = 200; // 200ms between batches
    const tokenBalances: any[] = [];

    for (let i = 0; i < tokenList.length; i += BATCH_SIZE) {
      const batch = tokenList.slice(i, i + BATCH_SIZE);
      
      console.log(`🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(tokenList.length / BATCH_SIZE)} (${batch.length} tokens)`);
      
      // Process each token in the batch
      const batchResults = await Promise.all(
        batch.map(async (tokenInfo: any) => {
          try {
            const balanceResponse = await axios.get(BASE_URL, {
              params: {
                chainid: chainId,
                module: 'account',
                action: 'tokenbalance',
                contractaddress: tokenInfo.contractAddress,
                address: address,
                tag: 'latest',
                apikey: ETHERSCAN_API_KEY
              }
            });

            if (balanceResponse.data.status === '1') {
              const balance = balanceResponse.data.result;
              const balanceNum = parseFloat(balance);
              
              // ✅ Log successful balance fetches
              if (balanceNum > 0) {
                console.log(`✅ ${tokenInfo.tokenSymbol}: ${balanceNum / Math.pow(10, tokenInfo.tokenDecimal)} (${balance} wei)`);
              }
              
              return {
                ...tokenInfo,
                balance: balance,
              };
            } else {
              // ✅ LOG the silent failure!
              console.warn(`⚠️ ${tokenInfo.tokenSymbol} balance fetch non-1 status:`, 
                balanceResponse.data.message || 'Unknown error',
                `(contract: ${tokenInfo.contractAddress.slice(0, 10)}...)`
              );
              
              // Keep the token with zero balance so it's not lost
              return {
                ...tokenInfo,
                balance: '0',
              };
            }
          } catch (error) {
            // ✅ LOG any errors
            console.error(`❌ Failed to get balance for ${tokenInfo.tokenSymbol} (${tokenInfo.contractAddress.slice(0, 10)}...):`, 
              error instanceof Error ? error.message : 'Unknown error'
            );
            
            // Keep the token with zero balance
            return {
              ...tokenInfo,
              balance: '0',
            };
          }
        })
      );

      tokenBalances.push(...batchResults);

      // ✅ Delay between batches (except after the last batch)
      if (i + BATCH_SIZE < tokenList.length) {
        console.log(`⏳ Waiting ${DELAY_MS}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }

    // ✅ LOG the final results
    const tokensWithBalance = tokenBalances.filter(
      token => parseFloat(token.balance) > 0
    );
    
    const zeroBalanceTokens = tokenBalances.filter(
      token => parseFloat(token.balance) === 0
    );

    console.log(`📊 Final results:`);
    console.log(`   ✅ ${tokensWithBalance.length} tokens with balance`);
    console.log(`   ⚠️ ${zeroBalanceTokens.length} tokens with zero balance`);
    
    if (zeroBalanceTokens.length > 0) {
      console.log(`   Zero balance tokens: ${zeroBalanceTokens.map(t => t.tokenSymbol).join(', ')}`);
    }

    return {
      status: '1',
      message: 'OK',
      result: tokensWithBalance
    };
  } catch (error) {
    console.error('❌ Error fetching token balances:', error);
    return {
      status: '0',
      message: 'Failed to fetch token balances',
      result: []
    };
  }
}

// ============================================================
// SINGLE TOKEN BALANCE
// ============================================================

export async function getTokenBalance(
  contractAddress: string,
  walletAddress: string,
  chain: ChainName = 'ethereum'
) {
  const chainId = getChainId(chain);
  const response = await axios.get(BASE_URL, {
    params: {
      chainid: chainId,
      module: 'account',
      action: 'tokenbalance',
      contractaddress: contractAddress,
      address: walletAddress,
      tag: 'latest',
      apikey: ETHERSCAN_API_KEY
    }
  });
  return response.data;
}

// ============================================================
// TRANSACTIONS
// ============================================================

export async function getTransactions(
  address: string,
  page = 1,
  offset = 15,
  chain: ChainName = 'ethereum'
) {
  const chainId = getChainId(chain);
  const response = await axios.get(BASE_URL, {
    params: {
      chainid: chainId,
      module: 'account',
      action: 'txlist',
      address: address,
      startblock: 0,
      endblock: 99999999,
      page: page,
      offset: offset,
      sort: 'desc',
      apikey: ETHERSCAN_API_KEY
    }
  });
  return response.data;
}

// ============================================================
// TOKEN TRANSFERS
// ============================================================

export async function getTokenTransfers(
  address: string,
  page = 1,
  offset = 15,
  chain: ChainName = 'ethereum'
) {
  const chainId = getChainId(chain);
  const response = await axios.get(BASE_URL, {
    params: {
      chainid: chainId,
      module: 'account',
      action: 'tokentx',
      address: address,
      startblock: 0,
      endblock: 99999999,
      page: page,
      offset: offset,
      sort: 'desc',
      apikey: ETHERSCAN_API_KEY
    }
  });
  return response.data;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

export function getExplorerUrl(address: string, chain: ChainName = 'ethereum'): string {
  const base = CHAIN_EXPLORERS[chain] || CHAIN_EXPLORERS.ethereum;
  return `${base}/address/${address}`;
}

export function getTxUrl(txHash: string, chain: ChainName = 'ethereum'): string {
  const base = CHAIN_EXPLORERS[chain] || CHAIN_EXPLORERS.ethereum;
  return `${base}/tx/${txHash}`;
}

export function formatAddress(address: string, chars = 6) {
  if (!address) return '';
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function formatAmount(amount: number, chain: ChainName = 'ethereum') {
  const symbol = CHAIN_SYMBOLS[chain] || 'ETH';
  return `${amount.toFixed(6)} ${symbol}`;
}

export function isSpamToken(tokenName: string, tokenSymbol: string): boolean {
  const name = (tokenName || '').toLowerCase();
  const symbol = (tokenSymbol || '').toLowerCase();
  
  const spamPatterns = [
    'claim', 'reward', 'airdrop', 'bonus', 'free', 
    't.me', 'telegram', 'visit', 'pool', 'stake',
    'shib', 'nft', 'paws', 'dydx', 'vault', 'promo',
    'giveaway', 'win', 'prize'
  ];
  
  return spamPatterns.some(pattern => 
    name.includes(pattern) || symbol.includes(pattern)
  );
}