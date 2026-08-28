// src/lib/services/dex.service.ts
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { ethers } from 'ethers';

// DEX Configuration
const DEX_CONFIGS = {
  ETHEREUM: {
    chainId: 1,
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
    dexes: {
      UNISWAP: {
        name: 'Uniswap',
        router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
        type: 'v2',
      },
      UNISWAP_V3: {
        name: 'Uniswap V3',
        router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
        type: 'v3',
      },
    },
  },
  POLYGON: {
    chainId: 137,
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
    dexes: {
      QUICKSWAP: {
        name: 'QuickSwap',
        router: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
        factory: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32',
        type: 'v2',
      },
      UNISWAP: {
        name: 'Uniswap',
        router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
        type: 'v3',
      },
    },
  },
  BSC: {
    chainId: 56,
    rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org',
    dexes: {
      PANCAKESWAP: {
        name: 'PancakeSwap',
        router: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
        factory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
        type: 'v2',
      },
    },
  },
  ARBITRUM: {
    chainId: 42161,
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    dexes: {
      UNISWAP: {
        name: 'Uniswap',
        router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
        type: 'v3',
      },
    },
  },
};

export interface SwapQuote {
  fromToken: string;
  toToken: string;
  fromAmount: number;
  toAmount: number;
  priceImpact: number;
  route: any[];
  dex: string;
  gasEstimate: number;
  slippage: number;
}

export interface SwapExecution {
  txHash: string;
  fromAmount: number;
  toAmount: number;
  dex: string;
  status: 'pending' | 'completed' | 'failed';
}

export class DexService {
  private static instance: DexService;

  static getInstance(): DexService {
    if (!DexService.instance) {
      DexService.instance = new DexService();
    }
    return DexService.instance;
  }

  /**
   * ✅ Get quote for a swap
   */
  async getQuote(
    chain: string,
    fromToken: string,
    toToken: string,
    amount: number,
    slippage: number = 0.5
  ): Promise<SwapQuote | null> {
    try {
      const chainConfig = DEX_CONFIGS[chain as keyof typeof DEX_CONFIGS];
      if (!chainConfig) {
        throw new Error(`Chain ${chain} not supported`);
      }

      // Find the best DEX for this swap
      const dexes = Object.values(chainConfig.dexes);
      let bestQuote: SwapQuote | null = null;

      for (const dex of dexes) {
        const quote = await this.getDexQuote(
          chain,
          dex,
          fromToken,
          toToken,
          amount
        );

        if (quote && (!bestQuote || quote.toAmount > bestQuote.toAmount)) {
          bestQuote = {
            ...quote,
            dex: dex.name,
            slippage,
          };
        }
      }

      return bestQuote;
    } catch (error) {
      logger.error('Failed to get swap quote:', error);
      return null;
    }
  }

  /**
   * ✅ Get quote from a specific DEX
   */
  private async getDexQuote(
    chain: string,
    dex: any,
    fromToken: string,
    toToken: string,
    amount: number
  ): Promise<any> {
    try {
      // For V2 DEXes (Uniswap V2, PancakeSwap, QuickSwap)
      if (dex.type === 'v2') {
        return await this.getV2Quote(chain, dex, fromToken, toToken, amount);
      }
      // For V3 DEXes (Uniswap V3)
      if (dex.type === 'v3') {
        return await this.getV3Quote(chain, dex, fromToken, toToken, amount);
      }
      return null;
    } catch (error) {
      logger.error(`Failed to get ${dex.name} quote:`, error);
      return null;
    }
  }

  /**
   * ✅ Get V2 DEX quote
   */
  private async getV2Quote(
    chain: string,
    dex: any,
    fromToken: string,
    toToken: string,
    amount: number
  ): Promise<any> {
    // Simulate V2 quote (use actual contract calls in production)
    const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

    // Mock prices (replace with actual price feeds)
    const prices: Record<string, number> = {
      [WETH]: 3500,
      [USDC]: 1,
    };

    const fromPrice = prices[fromToken] || 1;
    const toPrice = prices[toToken] || 1;

    const toAmount = (amount * fromPrice) / toPrice;
    const priceImpact = Math.random() * 0.5;
    const gasEstimate = 200000 * (Math.random() * 0.5 + 0.75);

    return {
      fromToken,
      toToken,
      fromAmount: amount,
      toAmount: toAmount * (1 - priceImpact / 100),
      priceImpact,
      route: [dex.name],
      gasEstimate,
    };
  }

  /**
   * ✅ Get V3 DEX quote
   */
  private async getV3Quote(
    chain: string,
    dex: any,
    fromToken: string,
    toToken: string,
    amount: number
  ): Promise<any> {
    // Similar to V2 but with V3 logic
    return await this.getV2Quote(chain, dex, fromToken, toToken, amount);
  }

  /**
   * ✅ Execute swap
   */
  async executeSwap(
    walletId: string,
    chain: string,
    fromToken: string,
    toToken: string,
    fromAmount: number,
    toAmount: number,
    dex: string,
    slippage: number = 0.5
  ): Promise<SwapExecution> {
    try {
      // Validate wallet exists
      const wallet = await prisma.wallet.findFirst({
        where: {
          id: walletId,
          isDeleted: false,
        },
      });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // Simulate transaction (replace with actual contract call)
      const txHash = `0x${Math.random().toString(16).slice(2, 66)}`;
      const status: 'pending' = 'pending';

      // Create trade record
      const trade = await prisma.dexTrade.create({
        data: {
          walletId,
          txHash,
          chain,
          dexName: dex,
          fromToken,
          fromSymbol: 'ETH', // Should be resolved from token address
          fromAmount,
          toToken,
          toSymbol: 'USDC',
          toAmount,
          slippage,
          status,
          timestamp: new Date(),
        },
      });

      // Simulate async completion
      this.simulateTradeCompletion(trade.id);

      return {
        txHash,
        fromAmount,
        toAmount,
        dex,
        status,
      };
    } catch (error) {
      logger.error('Failed to execute swap:', error);
      throw error;
    }
  }

  /**
   * ✅ Simulate trade completion (for demo)
   */
  private async simulateTradeCompletion(tradeId: string): Promise<void> {
    setTimeout(async () => {
      try {
        await prisma.dexTrade.update({
          where: { id: tradeId },
          data: {
            status: 'completed',
            completedAt: new Date(),
          },
        });
        logger.info(`Trade ${tradeId} completed`);
      } catch (error) {
        logger.error(`Trade ${tradeId} completion failed:`, error);
      }
    }, 5000);
  }

  /**
   * ✅ Get trade history for a wallet
   */
  async getTradeHistory(walletId: string, limit: number = 20) {
    return prisma.dexTrade.findMany({
      where: { walletId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }
}

export const dexService = DexService.getInstance();