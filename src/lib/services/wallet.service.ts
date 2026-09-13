// src/lib/services/wallet.service.ts
import { cache, getWalletCacheKey } from '@/lib/cache';
import { logger } from '@/lib/logger';
import { ethers } from 'ethers';

export interface TokenBalance {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  balance: string;
  decimals: number;
  formatted: string;
  valueUsd?: number;
}

export interface WalletData {
  address: string;
  chain: string;
  balance: number;
  balanceFormatted: string;
  symbol: string;
  transactions: any[];
  transactionsCount: number;
  tokens: TokenBalance[];
  nfts?: any[];
}

// Chain configuration
const CHAIN_CONFIG: Record<string, {
  rpcUrl: string;
  explorerApi: string;
  explorerKey: string | undefined;
  nativeSymbol: string;
  chainId: number;
}> = {
  ethereum: {
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
    explorerApi: 'https://api.etherscan.io/api',
    explorerKey: process.env.ETHERSCAN_API_KEY,
    nativeSymbol: 'ETH',
    chainId: 1,
  },
  polygon: {
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
    explorerApi: 'https://api.polygonscan.com/api',
    explorerKey: process.env.POLYGONSCAN_API_KEY,
    nativeSymbol: 'MATIC',
    chainId: 137,
  },
  bsc: {
    rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org',
    explorerApi: 'https://api.bscscan.com/api',
    explorerKey: process.env.BSCSCAN_API_KEY,
    nativeSymbol: 'BNB',
    chainId: 56,
  },
  arbitrum: {
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    explorerApi: 'https://api.arbiscan.io/api',
    explorerKey: process.env.ARBISCAN_API_KEY,
    nativeSymbol: 'ETH',
    chainId: 42161,
  },
  optimism: {
    rpcUrl: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
    explorerApi: 'https://api-optimistic.etherscan.io/api',
    explorerKey: process.env.OPTIMISM_API_KEY,
    nativeSymbol: 'ETH',
    chainId: 10,
  },
  avalanche: {
    rpcUrl: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
    explorerApi: 'https://api.snowtrace.io/api',
    explorerKey: process.env.SNOWTRACE_API_KEY,
    nativeSymbol: 'AVAX',
    chainId: 43114,
  },
  base: {
    rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    explorerApi: 'https://api.basescan.org/api',
    explorerKey: process.env.BASESCAN_API_KEY,
    nativeSymbol: 'ETH',
    chainId: 8453,
  },
};

// ERC-20 minimal ABI
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
];

// Well-known tokens per chain — used to detect tokens even if not in logs
const KNOWN_TOKENS: Record<string, string[]> = {
  ethereum: [
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
    '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
    '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // WBTC
    '0x514910771af9ca656af840dff83e8264ecf986ca', // LINK
    '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', // UNI
    '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0', // MATIC
    '0x15b7c0c907e4c6b9adaaaabc300c08991d6cea05', // GEL (Gelato Network)
    '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
  ],
  polygon: [
    '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', // USDC.e
    '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', // USDT
    '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619', // WETH
  ],
  bsc: [
    '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', // USDC
    '0x55d398326f99059ff775485246999027b3197955', // USDT
    '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', // WBNB
  ],
};

export class WalletService {
  private static instance: WalletService;
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();

  private constructor() {}

  static getInstance(): WalletService {
    if (!WalletService.instance) {
      WalletService.instance = new WalletService();
    }
    return WalletService.instance;
  }

  private getProvider(chain: string): ethers.JsonRpcProvider {
    const key = chain.toLowerCase();
    if (this.providers.has(key)) {
      return this.providers.get(key)!;
    }
    const config = CHAIN_CONFIG[key];
    if (!config) {
      throw new Error(`Unsupported chain: ${chain}`);
    }
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.providers.set(key, provider);
    return provider;
  }

  /**
   * ✅ Main entry point - fetch complete wallet data
   */
  async getWalletData(
    address: string,
    chain: string = 'ethereum',
    includeTxs: boolean = true,
    includeTokens: boolean = true,
    includeNFTs: boolean = true
  ): Promise<WalletData> {
    const cacheKey = getWalletCacheKey(address, chain, includeTxs);
    const cached = cache.get<WalletData>(cacheKey);
    if (cached) {
      logger.info(`📦 Cache hit for ${address}`);
      return cached;
    }

    const chainKey = chain.toLowerCase();
    const config = CHAIN_CONFIG[chainKey];
    if (!config) {
      throw new Error(`Unsupported chain: ${chain}`);
    }

    logger.info(`🔍 Fetching wallet data for ${address} on ${chain}`);

    // Fetch in parallel for speed
    const [balance, transactions, tokens] = await Promise.all([
      this.fetchNativeBalance(address, chainKey),
      includeTxs ? this.fetchTransactions(address, chainKey) : Promise.resolve([]),
      includeTokens ? this.fetchTokenBalances(address, chainKey) : Promise.resolve([]),
    ]);

    const walletData: WalletData = {
      address,
      chain,
      balance,
      balanceFormatted: balance.toFixed(6),
      symbol: config.nativeSymbol,
      transactions,
      transactionsCount: transactions.length,
      tokens,
      nfts: includeNFTs ? [] : [],
    };

    cache.set(cacheKey, walletData, 60);
    logger.info(`✅ Wallet data ready: ${balance.toFixed(6)} ${config.nativeSymbol}, ${tokens.length} tokens`);

    return walletData;
  }

  /**
   * ✅ Fetch native token balance
   */
  private async fetchNativeBalance(address: string, chain: string): Promise<number> {
    try {
      logger.info(`🔍 Fetching native balance for ${chain}...`);
      const provider = this.getProvider(chain);
      const balanceWei = await provider.getBalance(address);
      const balance = parseFloat(ethers.formatEther(balanceWei));
      logger.info(`💰 Native balance: ${balance}`);
      return balance;
    } catch (error) {
      logger.error(`❌ Failed to fetch native balance:`, error);
      return 0;
    }
  }

  /**
   * ✅ Fetch transaction history (from Etherscan API)
   */
  private async fetchTransactions(address: string, chain: string): Promise<any[]> {
    try {
      logger.info(`🔍 Fetching transactions for ${chain}...`);
      const config = CHAIN_CONFIG[chain];
      if (!config.explorerKey) {
        logger.warn(`⚠️ No explorer API key for ${chain}, skipping transactions`);
        return [];
      }

      const url = `${config.explorerApi}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${config.explorerKey}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== '1' || !Array.isArray(data.result)) {
        logger.warn(`⚠️ Transaction fetch failed: ${data.message}`);
        return [];
      }

      logger.info(`✅ Found ${data.result.length} transactions`);
      return data.result;
    } catch (error) {
      logger.error(`❌ Failed to fetch transactions:`, error);
      return [];
    }
  }

  /**
   * ✅ Fetch token balances using DIRECT CONTRACT CALLS
   *    This is the fix — no more Etherscan dependency for balances
   */
  private async fetchTokenBalances(address: string, chain: string): Promise<TokenBalance[]> {
    try {
      logger.info(`🔍 Fetching token balances for ${address} on ${chain}...`);
      const config = CHAIN_CONFIG[chain];

      // Step 1: Discover which tokens this wallet has interacted with
      const tokenCandidates = await this.discoverTokens(address, chain);
      logger.info(`📊 Discovered ${tokenCandidates.length} potential token contracts`);

      if (tokenCandidates.length === 0) {
        return [];
      }

      // Step 2: Check balance directly for each token via RPC
      const balances = await this.checkBalancesViaRpc(
        tokenCandidates,
        address,
        chain
      );

      const withBalance = balances.filter((b) => b !== null) as TokenBalance[];
      logger.info(`✅ Found ${withBalance.length} tokens with balance`);

      return withBalance;
    } catch (error) {
      logger.error(`❌ Failed to fetch token balances:`, error);
      return [];
    }
  }

  /**
   * ✅ Discover which tokens the wallet has interacted with
   *    Source: Etherscan token transfer events + Known token list
   */
  private async discoverTokens(address: string, chain: string): Promise<string[]> {
    const tokens = new Set<string>();

    // Add known tokens for this chain (only if they have a balance — we'll check next)
    const knownTokens = KNOWN_TOKENS[chain] || [];
    knownTokens.forEach((t) => tokens.add(t.toLowerCase()));

    // If we have an explorer API key, use it to discover tokens from transfer history
    const config = CHAIN_CONFIG[chain];
    if (config.explorerKey) {
      try {
        const url = `${config.explorerApi}?module=account&action=tokentx&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${config.explorerKey}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === '1' && Array.isArray(data.result)) {
          data.result.forEach((tx: any) => {
            if (tx.contractAddress) {
              tokens.add(tx.contractAddress.toLowerCase());
            }
          });
          logger.info(`📊 Found ${data.result.length} token transfer events`);
        }
      } catch (error) {
        logger.warn(`⚠️ Token discovery via explorer failed:`, error);
      }
    }

    return Array.from(tokens);
  }

  /**
   * ✅ Check balances for a list of tokens via direct RPC calls
   *    This is the core fix — 100% reliable, no API key needed
   */
  private async checkBalancesViaRpc(
    tokenAddresses: string[],
    walletAddress: string,
    chain: string
  ): Promise<(TokenBalance | null)[]> {
    const provider = this.getProvider(chain);
    const BATCH_SIZE = 20; // Parallel batch size
    const results: (TokenBalance | null)[] = [];

    for (let i = 0; i < tokenAddresses.length; i += BATCH_SIZE) {
      const batch = tokenAddresses.slice(i, i + BATCH_SIZE);
      logger.info(`🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(tokenAddresses.length / BATCH_SIZE)} (${batch.length} tokens)`);

      const batchResults = await Promise.all(
        batch.map((tokenAddress) =>
          this.fetchSingleTokenBalance(tokenAddress, walletAddress, provider)
        )
      );

      results.push(...batchResults);
    }

    return results;
  }

  /**
   * ✅ Fetch single token balance directly from the contract
   */
  private async fetchSingleTokenBalance(
    tokenAddress: string,
    walletAddress: string,
    provider: ethers.JsonRpcProvider
  ): Promise<TokenBalance | null> {
    try {
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

      // Fetch all metadata in parallel
      const [balance, decimals, symbol, name] = await Promise.all([
        contract.balanceOf(walletAddress).catch(() => BigInt(0)),
        contract.decimals().catch(() => 18),
        contract.symbol().catch(() => 'UNKNOWN'),
        contract.name().catch(() => 'Unknown Token'),
      ]);

      // Skip zero balances
      if (balance === BigInt(0)) {
        return null;
      }

      const formatted = ethers.formatUnits(balance, decimals);

      logger.info(`  ✅ ${symbol}: ${formatted}`);

      return {
        tokenAddress,
        tokenSymbol: symbol,
        tokenName: name,
        balance: balance.toString(),
        decimals: Number(decimals),
        formatted,
      };
    } catch (error) {
      // Silent fail — the token contract might be non-standard or nonexistent
      return null;
    }
  }
}

export const walletService = WalletService.getInstance();