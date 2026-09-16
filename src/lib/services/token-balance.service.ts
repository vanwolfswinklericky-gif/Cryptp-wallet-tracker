// src/lib/services/token-balance.service.ts
import { ethers } from 'ethers';
import { logger } from '@/lib/logger';

// ERC-20 ABI
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
];

// ============================================================
// ✅ Alchemy chain name mapping
// ============================================================
const ALCHEMY_CHAINS: Record<string, string> = {
  ethereum: 'eth-mainnet',
  polygon: 'polygon-mainnet',
  bsc: 'bnb-mainnet',
  arbitrum: 'arb-mainnet',
  optimism: 'opt-mainnet',
  avalanche: 'avax-mainnet',
  base: 'base-mainnet',
};

// ============================================================
// ✅ Public RPC fallbacks (used ONLY if Alchemy key is missing)
// ============================================================
const PUBLIC_RPC_FALLBACKS: Record<string, string> = {
  ethereum: 'https://rpc.ankr.com/eth',
  polygon: 'https://rpc.ankr.com/polygon',
  bsc: 'https://rpc.ankr.com/bsc',
  arbitrum: 'https://rpc.ankr.com/arbitrum',
  optimism: 'https://rpc.ankr.com/optimism',
  avalanche: 'https://rpc.ankr.com/avalanche',
  base: 'https://mainnet.base.org',
};

export interface TokenBalance {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  balance: string;
  decimals: number;
  formatted: string;
}

export class TokenBalanceService {
  private static instance: TokenBalanceService;
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();

  static getInstance(): TokenBalanceService {
    if (!TokenBalanceService.instance) {
      TokenBalanceService.instance = new TokenBalanceService();
    }
    return TokenBalanceService.instance;
  }

  /**
   * ✅ Build RPC URL from ALCHEMY_API_KEY
   */
  private getRpcUrl(chain: string): string {
    const chainKey = chain.toLowerCase();
    const alchemyKey = process.env.ALCHEMY_API_KEY;

    // Log once per request to help debug
    logger.info(`🔑 Env check — ALCHEMY_API_KEY present: ${!!alchemyKey}, length: ${alchemyKey?.length || 0}`);

    if (alchemyKey && alchemyKey.length > 10) {
      const alchemyChain = ALCHEMY_CHAINS[chainKey] || 'eth-mainnet';
      const url = `https://${alchemyChain}.g.alchemy.com/v2/${alchemyKey}`;
      logger.info(`✅ Using Alchemy RPC for ${chain}: ${alchemyChain}`);
      return url;
    }

    // Fallback to public RPC if no key is set
    logger.warn(`⚠️ ALCHEMY_API_KEY not set — falling back to public RPC for ${chain}`);
    const fallback = PUBLIC_RPC_FALLBACKS[chainKey];
    if (!fallback) {
      throw new Error(`No RPC endpoint available for chain: ${chain}`);
    }
    return fallback;
  }

  /**
   * ✅ Get or create a provider for the given chain
   */
  private getProvider(chain: string): ethers.JsonRpcProvider {
    const key = chain.toLowerCase();

    if (this.providers.has(key)) {
      return this.providers.get(key)!;
    }

    const rpcUrl = this.getRpcUrl(chain);

    // ⚠️ IMPORTANT: staticNetwork: true prevents "failed to detect network" errors
    const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
      staticNetwork: true,
    });

    this.providers.set(key, provider);
    return provider;
  }

  /**
   * ✅ Get single token balance directly from contract
   */
  async getTokenBalance(
    tokenAddress: string,
    walletAddress: string,
    chain: string
  ): Promise<TokenBalance | null> {
    try {
      const provider = this.getProvider(chain);
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

      const [balance, decimals, symbol, name] = await Promise.all([
        contract.balanceOf(walletAddress).catch(() => BigInt(0)),
        contract.decimals().catch(() => 18),
        contract.symbol().catch(() => 'UNKNOWN'),
        contract.name().catch(() => 'Unknown Token'),
      ]);

      if (balance === BigInt(0)) {
        return null;
      }

      const formatted = ethers.formatUnits(balance, decimals);
      logger.info(`✅ ${symbol}: ${formatted}`);

      return {
        tokenAddress,
        tokenSymbol: symbol,
        tokenName: name,
        balance: balance.toString(),
        decimals: Number(decimals),
        formatted,
      };
    } catch (error) {
      logger.error(`❌ Failed to fetch ${tokenAddress} balance:`, error);
      return null;
    }
  }

  /**
   * ✅ Get multiple token balances in parallel
   */
  async getTokenBalances(
    tokenAddresses: string[],
    walletAddress: string,
    chain: string
  ): Promise<TokenBalance[]> {
    if (tokenAddresses.length === 0) return [];

    logger.info(`🔄 Fetching ${tokenAddresses.length} token balances on ${chain}...`);

    const results = await Promise.all(
      tokenAddresses.map((addr) =>
        this.getTokenBalance(addr, walletAddress, chain)
      )
    );

    const valid = results.filter((r): r is TokenBalance => r !== null);
    logger.info(`✅ Found ${valid.length}/${tokenAddresses.length} tokens with balance`);

    return valid;
  }
}

export const tokenBalanceService = TokenBalanceService.getInstance();