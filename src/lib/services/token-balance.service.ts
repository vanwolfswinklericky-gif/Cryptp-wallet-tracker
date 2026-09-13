// src/lib/services/token-balance.service.ts
import { ethers } from 'ethers';
import { logger } from '@/lib/logger';

// ERC-20 ABI - just the functions we need
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
];

// Public RPC endpoints (use these as fallback when Etherscan fails)
const RPC_ENDPOINTS: Record<string, string> = {
  ethereum: 'https://eth.llamarpc.com',
  polygon: 'https://polygon-rpc.com',
  bsc: 'https://bsc-dataseed1.binance.org',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  optimism: 'https://mainnet.optimism.io',
  avalanche: 'https://api.avax.network/ext/bc/C/rpc',
  base: 'https://mainnet.base.org',
};

export interface TokenBalance {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  balance: string;      // Raw balance (wei-style)
  decimals: number;
  formatted: string;    // Human-readable balance
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

  private getProvider(chain: string): ethers.JsonRpcProvider {
    const key = chain.toLowerCase();
    
    if (this.providers.has(key)) {
      return this.providers.get(key)!;
    }

    const rpcUrl = RPC_ENDPOINTS[key];
    if (!rpcUrl) {
      throw new Error(`No RPC endpoint for chain: ${chain}`);
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
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

      // Fetch all three in parallel for speed
      const [balance, decimals, symbol, name] = await Promise.all([
        contract.balanceOf(walletAddress).catch(() => BigInt(0)),
        contract.decimals().catch(() => 18),
        contract.symbol().catch(() => 'UNKNOWN'),
        contract.name().catch(() => 'Unknown Token'),
      ]);

      // Skip if balance is zero
      if (balance === BigInt(0)) {
        return null;
      }

      const formatted = ethers.formatUnits(balance, decimals);

      logger.info(`✅ ${symbol}: ${formatted} (${balance.toString()} raw)`);

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
    logger.info(`🔄 Fetching ${tokenAddresses.length} token balances...`);

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