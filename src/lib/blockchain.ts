// src/lib/blockchain.ts

import { 
  getSolanaBalanceWithFallback, 
  getSolanaRpcUrls,
  //getBalanceWithFallback,
  //getChainConfig,
  //isChainSupported 
} from './providers';
import { 
  cache, 
  getBitcoinCacheKey, 
  getSolanaCacheKey, 
  getWalletCacheKey,
  cachedFetch 
} from './cache';

// ============================================================
// BITCOIN API (with caching and multiple providers)
// ============================================================

// Bitcoin API endpoints (free, more generous limits)
const BITCOIN_PROVIDERS = [
  {
    name: 'mempool.space',
    url: (address: string) => `https://mempool.space/api/address/${address}`,
    balancePath: (data: any) => data.chain_stats?.funded_txo_sum - data.chain_stats?.spent_txo_sum,
    txPath: (data: any) => data.chain_stats?.tx_count || 0,
  },
  {
    name: 'Blockstream',
    url: (address: string) => `https://blockstream.info/api/address/${address}`,
    balancePath: (data: any) => data.chain_stats?.funded_txo_sum - data.chain_stats?.spent_txo_sum,
    txPath: (data: any) => data.chain_stats?.tx_count || 0,
  },
  {
    name: 'Blockchair',
    url: (address: string) => `https://api.blockchair.com/bitcoin/dashboards/address/${address}`,
    balancePath: (data: any) => data.data?.[address]?.address?.balance || 0,
    txPath: (data: any) => data.data?.[address]?.address?.transaction_count || 0,
  },
];

/**
 * Get Bitcoin balance with caching and fallback providers
 */
export async function getBitcoinBalance(address: string): Promise<number> {
  const cacheKey = getBitcoinCacheKey(address);
  
  return cachedFetch(
    cacheKey,
    async () => {
      // Try each provider
      for (const provider of BITCOIN_PROVIDERS) {
        try {
          console.log(`🔌 Trying Bitcoin provider: ${provider.name}`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const response = await fetch(provider.url(address), {
            headers: { 'Accept': 'application/json' },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const data = await response.json();
          
          // Extract balance using provider's path
          let satoshis = 0;
          if (typeof provider.balancePath === 'function') {
            const balance = provider.balancePath(data);
            satoshis = typeof balance === 'number' ? balance : 0;
          }

          // Ensure we have a valid number
          if (typeof satoshis !== 'number' || isNaN(satoshis)) {
            satoshis = 0;
          }

          const btcBalance = satoshis / 100000000;
          
          if (btcBalance > 0 || satoshis !== 0) {
            console.log(`✅ Bitcoin balance for ${address}: ${btcBalance} BTC (from ${provider.name})`);
            return btcBalance;
          }
          
          console.log(`ℹ️ No balance found for ${address} (${provider.name})`);
        } catch (error) {
          console.warn(`⚠️ Bitcoin provider ${provider.name} failed:`, error instanceof Error ? error.message : 'Unknown');
        }
      }

      console.warn(`⚠️ All Bitcoin providers failed for ${address}`);
      return 0;
    },
    60 // 60 second TTL
  );
}

/**
 * Get Bitcoin transactions with caching and fallback
 */
export async function getBitcoinTransactions(address: string, limit: number = 10): Promise<any[]> {
  const cacheKey = `btc:txs:${address}:${limit}`;
  
  return cachedFetch(
    cacheKey,
    async () => {
      for (const provider of BITCOIN_PROVIDERS) {
        try {
          console.log(`🔌 Trying Bitcoin transactions from: ${provider.name}`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const response = await fetch(provider.url(address), {
            headers: { 'Accept': 'application/json' },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const data = await response.json();
          
          // Handle different provider formats
          let txs = [];
          
          if (provider.name === 'mempool.space' || provider.name === 'Blockstream') {
            // Get recent transactions from mempool/blockstream
            const txIds = data.chain_stats?.tx_count > 0 ? 
              await getBitcoinTransactionIds(address, provider) : [];
            
            // If we have transaction IDs, fetch details
            if (txIds.length > 0) {
              const txDetails = await Promise.all(
                txIds.slice(0, limit).map(async (txId: string) => {
                  try {
                    const txResponse = await fetch(
                      `https://mempool.space/api/tx/${txId}`,
                      { signal: controller.signal }
                    );
                    const txData = await txResponse.json();
                    return {
                      hash: txId,
                      from: txData.vin?.[0]?.prevout?.scriptpubkey_address || 'Unknown',
                      to: txData.vout?.[0]?.scriptpubkey_address || 'Unknown',
                      value: (txData.vout?.reduce((sum: number, v: any) => sum + v.value, 0) || 0),
                      timeStamp: txData.status?.block_time || Date.now() / 1000,
                      status: 'success',
                    };
                  } catch (e) {
                    return null;
                  }
                })
              );
              txs = txDetails.filter(Boolean);
            }
          } else if (provider.name === 'Blockchair') {
            // Blockchair format
            const rawTxs = data.data?.[address]?.transactions || [];
            txs = rawTxs.slice(0, limit).map((tx: any) => ({
              hash: tx.hash,
              from: tx.inputs?.[0]?.recipient || 'Unknown',
              to: tx.outputs?.[0]?.recipient || 'Unknown',
              value: tx.output_total / 100000000,
              timeStamp: tx.time,
              status: 'success',
            }));
          }

          if (txs.length > 0) {
            console.log(`✅ Found ${txs.length} Bitcoin transactions from ${provider.name}`);
            return txs;
          }
        } catch (error) {
          console.warn(`⚠️ Bitcoin transaction provider ${provider.name} failed:`, error);
        }
      }

      console.warn(`⚠️ All Bitcoin transaction providers failed for ${address}`);
      return [];
    },
    120 // 2 minute TTL for transactions
  );
}

/**
 * Helper to get Bitcoin transaction IDs
 */
async function getBitcoinTransactionIds(address: string, provider: any): Promise<string[]> {
  try {
    const response = await fetch(
      `https://mempool.space/api/address/${address}/txs`,
      { headers: { 'Accept': 'application/json' } }
    );
    
    if (!response.ok) return [];
    
    const data = await response.json();
    return data.map((tx: any) => tx.txid).filter(Boolean);
  } catch (error) {
    return [];
  }
}

// ============================================================
// SOLANA API (with caching and fallback RPCs)
// ============================================================

/**
 * Get Solana balance with caching and fallback RPCs
 */
export async function getSolanaBalance(address: string): Promise<number> {
  const cacheKey = getSolanaCacheKey(address);
  
  return cachedFetch(
    cacheKey,
    async () => {
      try {
        const { balance, source } = await getSolanaBalanceWithFallback(address);
        console.log(`✅ Solana balance for ${address}: ${balance} SOL (from ${source})`);
        return balance;
      } catch (error) {
        console.error('❌ Failed to fetch Solana balance:', error);
        return 0;
      }
    },
    30 // 30 second TTL for Solana
  );
}

/**
 * Get Solana transactions with caching and fallback
 */
export async function getSolanaTransactions(address: string, limit: number = 10): Promise<any[]> {
  const cacheKey = `sol:txs:${address}:${limit}`;
  const rpcUrls = getSolanaRpcUrls();

  return cachedFetch(
    cacheKey,
    async () => {
      for (const rpcUrl of rpcUrls) {
        try {
          console.log(`🔌 Trying Solana RPC for transactions: ${rpcUrl.replace(/\/\/.*@/, '//*****@')}`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          // First, get signatures
          const sigResponse = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'getSignaturesForAddress',
              params: [address, { limit: limit }],
            }),
          });

          if (!sigResponse.ok) continue;

          const sigData = await sigResponse.json();
          
          if (sigData.error) {
            console.warn(`⚠️ Solana RPC error: ${sigData.error.message}`);
            continue;
          }

          const signatures = sigData.result || [];
          
          if (signatures.length === 0) {
            console.log(`ℹ️ No transactions found for Solana address: ${address}`);
            return [];
          }
          
          // Get transaction details for each signature
          const txs = await Promise.all(
            signatures.map(async (sig: any) => {
              try {
                const txResponse = await fetch(rpcUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  signal: controller.signal,
                  body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getTransaction',
                    params: [sig.signature, { maxSupportedTransactionVersion: 0 }],
                  }),
                });
                const txData = await txResponse.json();
                
                const tx = txData.result;
                if (!tx) {
                  return {
                    hash: sig.signature,
                    from: address,
                    to: address,
                    value: 0,
                    timeStamp: sig.blockTime,
                    status: sig.confirmationStatus || 'unknown',
                  };
                }
                
                const preBalance = tx?.meta?.preBalances?.[0] || 0;
                const postBalance = tx?.meta?.postBalances?.[0] || 0;
                const amount = Math.abs(postBalance - preBalance) / 1000000000;
                
                return {
                  hash: sig.signature,
                  from: address,
                  to: address,
                  value: amount,
                  timeStamp: sig.blockTime,
                  status: sig.confirmationStatus || 'success',
                };
              } catch (e) {
                return {
                  hash: sig.signature,
                  from: address,
                  to: address,
                  value: 0,
                  timeStamp: sig.blockTime,
                  status: sig.confirmationStatus || 'unknown',
                };
              }
            })
          );

          clearTimeout(timeoutId);

          const validTxs = txs.filter(tx => tx.value > 0 || tx.status === 'success');
          console.log(`✅ Found ${validTxs.length} Solana transactions`);
          return validTxs;
        } catch (error) {
          console.warn(`⚠️ Solana RPC failed:`, error);
        }
      }

      console.error('❌ All Solana RPCs failed');
      return [];
    },
    120 // 2 minute TTL for transactions
  );
}

// ============================================================
// EVM CHAIN BALANCE (with caching)
// ============================================================

/**
 * Get EVM chain balance with caching
 */
export async function getEvmBalance(
  address: string,
  chain: string,
  explorerApiFn: (address: string, chain: string) => Promise<any>
): Promise<{ balance: number; source: string }> {
  const cacheKey = getWalletCacheKey(address, chain, false);
  
  return cachedFetch(
    cacheKey,
    async () => {
      return getBalanceWithFallback(address, chain, explorerApiFn);
    },
    60 // 60 second TTL
  );
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Validate addresses for different chains
 */
export function validateAddress(address: string, chain: string): boolean {
  if (!address || address.trim() === '') return false;
  
  const cleanAddress = address.trim();
  
  switch (chain) {
    case 'bitcoin':
      // Bitcoin address formats: P2PKH (1...), P2SH (3...), Bech32 (bc1...)
      return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(cleanAddress) || 
             /^bc1[a-zA-Z0-9]{39,59}$/.test(cleanAddress) ||
             /^[A-Za-z0-9]{26,35}$/.test(cleanAddress);
    case 'solana':
      // Solana address is base58 encoded, 32-44 characters
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(cleanAddress);
    case 'ethereum':
    case 'polygon':
    case 'bsc':
    case 'arbitrum':
    case 'optimism':
    case 'avalanche':
    case 'base':
      // Ethereum-style addresses
      return /^0x[a-fA-F0-9]{40}$/.test(cleanAddress);
    default:
      return /^0x[a-fA-F0-9]{40}$/.test(cleanAddress);
  }
}

/**
 * Get chain explorer URL for address
 */
export function getChainExplorerUrl(address: string, chain: string): string {
  const explorers: Record<string, string> = {
    ethereum: 'https://etherscan.io/address/',
    polygon: 'https://polygonscan.com/address/',
    bsc: 'https://bscscan.com/address/',
    arbitrum: 'https://arbiscan.io/address/',
    optimism: 'https://optimistic.etherscan.io/address/',
    avalanche: 'https://snowtrace.io/address/',
    base: 'https://basescan.org/address/',
    bitcoin: 'https://mempool.space/address/',
    solana: 'https://solscan.io/account/',
  };
  
  return (explorers[chain] || explorers.ethereum) + address;
}

/**
 * Format address for display (shorten)
 */
export function formatAddressShort(address: string, chars: number = 6): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Check if address is valid for any chain
 */
export function isValidAddress(address: string): boolean {
  return validateAddress(address, 'ethereum') ||
         validateAddress(address, 'bitcoin') ||
         validateAddress(address, 'solana');
}

/**
 * Clear cache for a specific address/chain
 */
export function clearAddressCache(address: string, chain: string): void {
  const keys = [
    getWalletCacheKey(address, chain, false),
    getWalletCacheKey(address, chain, true),
    getBitcoinCacheKey(address),
    getSolanaCacheKey(address),
    `btc:txs:${address}`,
    `sol:txs:${address}`,
  ];
  
  keys.forEach(key => {
    if (cache.has(key)) {
      cache.delete(key);
      console.log(`🗑️ Cache cleared for: ${key}`);
    }
  });
}