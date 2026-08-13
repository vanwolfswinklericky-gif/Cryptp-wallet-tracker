// src/lib/providers.ts

import { ethers } from 'ethers';

// ============================================================
// SAFE ENVIRONMENT VARIABLE ACCESS (prevents build failures)
// ============================================================

const getEnv = (key: string, fallback: string = ''): string => {
  // During build time, return fallback to prevent build failures
  if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
    console.warn(`⚠️ Build-time fallback for ${key}`);
    return fallback;
  }
  const value = process.env[key];
  if (!value) {
    console.warn(`⚠️ Environment variable ${key} is not set, using fallback`);
    return fallback;
  }
  return value;
};

// Now use getEnv() for all environment variables
const ETHERSCAN_API_KEY = getEnv('ETHERSCAN_API_KEY', '');
const ALCHEMY_API_KEY = getEnv('ALCHEMY_API_KEY', '');
const INFURA_API_KEY = getEnv('INFURA_API_KEY', '');
const INFURA_SOLANA_API_KEY = getEnv('INFURA_SOLANA_API_KEY', '');
const INFURA_POLYGON_API_KEY = getEnv('INFURA_POLYGON_API_KEY', '');

// ============================================================
// CHAIN CONFIGURATIONS
// ============================================================

interface ChainProvider {
  chainId: number;
  name: string;
  symbol: string;
  rpcUrls: string[];
  explorerApiUrl: string;
  explorerApiKey?: string;
  priority: number; // Lower = higher priority
}

export const CHAIN_PROVIDERS: Record<string, ChainProvider> = {
  ethereum: {
    chainId: 1,
    name: 'Ethereum',
    symbol: 'ETH',
    priority: 1,
    rpcUrls: [
      `https://mainnet.infura.io/v3/${INFURA_API_KEY}`,
      `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      'https://rpc.ankr.com/eth',
    ].filter(url => !url.includes('undefined') && !url.includes('null')),
    explorerApiUrl: 'https://api.etherscan.io/api',
    explorerApiKey: ETHERSCAN_API_KEY,
  },
  polygon: {
    chainId: 137,
    name: 'Polygon',
    symbol: 'MATIC',
    priority: 1,
    rpcUrls: [
      `https://polygon-mainnet.infura.io/v3/${INFURA_POLYGON_API_KEY}`,
      `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      'https://rpc.ankr.com/polygon',
    ].filter(url => !url.includes('undefined') && !url.includes('null')),
    explorerApiUrl: 'https://api.polygonscan.com/api',
    explorerApiKey: ETHERSCAN_API_KEY,
  },
  bsc: {
    chainId: 56,
    name: 'BSC',
    symbol: 'BNB',
    priority: 2,
    rpcUrls: [
      'https://bsc-dataseed1.binance.org',
      'https://bsc-dataseed2.binance.org',
      'https://rpc.ankr.com/bsc',
    ],
    explorerApiUrl: 'https://api.bscscan.com/api',
    explorerApiKey: ETHERSCAN_API_KEY,
  },
  arbitrum: {
    chainId: 42161,
    name: 'Arbitrum',
    symbol: 'ETH',
    priority: 1,
    rpcUrls: [
      `https://arbitrum-mainnet.infura.io/v3/${INFURA_API_KEY}`,
      `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      'https://rpc.ankr.com/arbitrum',
    ].filter(url => !url.includes('undefined') && !url.includes('null')),
    explorerApiUrl: 'https://api.arbiscan.io/api',
    explorerApiKey: ETHERSCAN_API_KEY,
  },
  optimism: {
    chainId: 10,
    name: 'Optimism',
    symbol: 'ETH',
    priority: 1,
    rpcUrls: [
      `https://optimism-mainnet.infura.io/v3/${INFURA_API_KEY}`,
      `https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      'https://rpc.ankr.com/optimism',
    ].filter(url => !url.includes('undefined') && !url.includes('null')),
    explorerApiUrl: 'https://api-optimistic.etherscan.io/api',
    explorerApiKey: ETHERSCAN_API_KEY,
  },
  avalanche: {
    chainId: 43114,
    name: 'Avalanche',
    symbol: 'AVAX',
    priority: 2,
    rpcUrls: [
      'https://api.avax.network/ext/bc/C/rpc',
      `https://avalanche-mainnet.infura.io/v3/${INFURA_API_KEY}`,
      'https://rpc.ankr.com/avalanche',
    ].filter(url => !url.includes('undefined') && !url.includes('null')),
    explorerApiUrl: 'https://api.snowtrace.io/api',
    explorerApiKey: ETHERSCAN_API_KEY,
  },
  base: {
    chainId: 8453,
    name: 'Base',
    symbol: 'ETH',
    priority: 2,
    rpcUrls: [
      'https://mainnet.base.org',
      `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      'https://rpc.ankr.com/base',
    ].filter(url => !url.includes('undefined') && !url.includes('null')),
    explorerApiUrl: 'https://api.basescan.org/api',
    explorerApiKey: ETHERSCAN_API_KEY,
  },
};

// ============================================================
// SOLANA PROVIDER (Special handling)
// ============================================================

export const SOLANA_RPC_URLS = [
  `https://solana-mainnet.infura.io/v3/${INFURA_SOLANA_API_KEY}`,
  'https://api.mainnet-beta.solana.com',
  'https://rpc.ankr.com/solana',
].filter(url => url && typeof url === 'string' && !url.includes('undefined') && !url.includes('null'));

// Ensure we always have at least one URL
if (SOLANA_RPC_URLS.length === 0) {
  SOLANA_RPC_URLS.push('https://api.mainnet-beta.solana.com');
}

export function getSolanaRpcUrls(): string[] {
  return SOLANA_RPC_URLS;
}

export function getSolanaRpcUrl(): string {
  return SOLANA_RPC_URLS[0] || 'https://api.mainnet-beta.solana.com';
}

// ============================================================
// RPC BALANCE FETCHER (Fallback when Explorer API fails)
// ============================================================

/**
 * Get balance directly from RPC (fallback for Explorer API failures)
 */
export async function getBalanceFromRPC(
  address: string,
  chain: string
): Promise<{ status: string; result: string; provider: string }> {
  const config = CHAIN_PROVIDERS[chain];
  if (!config) {
    throw new Error(`Unsupported chain: ${chain}`);
  }

  // Get RPC URLs and filter out any invalid ones
  const rpcUrls = config.rpcUrls.filter(url => 
    url && typeof url === 'string' && !url.includes('undefined') && !url.includes('null')
  );

  if (rpcUrls.length === 0) {
    throw new Error(`No valid RPC URLs for chain: ${chain}`);
  }

  for (const rpcUrl of rpcUrls) {
    try {
      console.log(`🔌 Trying RPC: ${rpcUrl.replace(/\/\/.*@/, '//*****@')}`);
      
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      // Set a timeout to prevent hanging
      const balancePromise = provider.getBalance(address);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('RPC timeout')), 5000)
      );
      const balance = await Promise.race([balancePromise, timeoutPromise]);
      
      return {
        status: '1',
        result: balance.toString(),
        provider: rpcUrl,
      };
    } catch (error) {
      console.warn(`⚠️ RPC failed: ${rpcUrl}`, error instanceof Error ? error.message : 'Unknown error');
      // Continue to next RPC
    }
  }

  throw new Error(`All RPCs failed for ${chain}`);
}

/**
 * Get balance with fallback: Explorer API → RPC
 */
export async function getBalanceWithFallback(
  address: string,
  chain: string,
  explorerApiFn: (address: string, chain: string) => Promise<any>
): Promise<{ balance: number; source: string }> {
  // Try Explorer API first
  try {
    console.log(`🔍 Trying Explorer API for ${chain}...`);
    const result = await explorerApiFn(address, chain);
    
    if (result?.status === '1' && result?.result) {
      const balance = parseFloat(result.result) / 1e18;
      console.log(`✅ Explorer API succeeded for ${chain}`);
      return { balance, source: 'explorer-api' };
    }
    
    console.warn(`⚠️ Explorer API returned error: ${result?.message || 'Unknown error'}`);
  } catch (error) {
    console.warn(`⚠️ Explorer API failed:`, error instanceof Error ? error.message : 'Unknown error');
  }

  // Fallback to RPC
  console.log(`🔄 Falling back to RPC for ${chain}...`);
  try {
    const rpcResult = await getBalanceFromRPC(address, chain);
    const balance = parseFloat(rpcResult.result) / 1e18;
    console.log(`✅ RPC succeeded for ${chain}`);
    return { balance, source: 'rpc' };
  } catch (error) {
    console.error(`❌ RPC fallback failed for ${chain}:`, error);
    return { balance: 0, source: 'none' };
  }
}

// ============================================================
// SOLANA BALANCE FETCHER
// ============================================================

/**
 * Get Solana balance with fallback RPCs
 */
export async function getSolanaBalanceWithFallback(
  address: string
): Promise<{ balance: number; source: string }> {
  const rpcUrls = SOLANA_RPC_URLS.filter(url => 
    url && typeof url === 'string' && !url.includes('undefined') && !url.includes('null')
  );

  if (rpcUrls.length === 0) {
    console.warn('⚠️ No valid Solana RPC URLs configured');
    return { balance: 0, source: 'none' };
  }

  for (const rpcUrl of rpcUrls) {
    try {
      console.log(`🔌 Trying Solana RPC: ${rpcUrl.replace(/\/\/.*@/, '//*****@')}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [address],
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) continue;

      const data = await response.json();
      
      if (data.error) {
        console.warn(`⚠️ Solana RPC error: ${data.error.message}`);
        continue;
      }

      const lamports = data.result?.value || 0;
      const balance = lamports / 1000000000;
      console.log(`✅ Solana RPC succeeded`);
      return { balance, source: rpcUrl };
    } catch (error) {
      console.warn(`⚠️ Solana RPC failed:`, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  console.warn(`⚠️ All Solana RPCs failed`);
  return { balance: 0, source: 'none' };
}

// ============================================================
// UTILITIES
// ============================================================

export function getSupportedChains(): string[] {
  return Object.keys(CHAIN_PROVIDERS);
}

export function isChainSupported(chain: string): boolean {
  return chain in CHAIN_PROVIDERS;
}

export function getChainConfig(chain: string): ChainProvider | null {
  return CHAIN_PROVIDERS[chain] || null;
}

export function getDefaultRpcUrl(chain: string): string {
  const config = CHAIN_PROVIDERS[chain];
  if (!config || config.rpcUrls.length === 0) {
    return '';
  }
  return config.rpcUrls[0];
}