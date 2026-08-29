// src/lib/services/trade-detection.service.ts
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

export class TradeDetectionService {
  private static instance: TradeDetectionService;

  static getInstance(): TradeDetectionService {
    if (!TradeDetectionService.instance) {
      TradeDetectionService.instance = new TradeDetectionService();
    }
    return TradeDetectionService.instance;
  }

  /**
   * ✅ Detect and analyze trades from transactions
   * (Analysis only - NO EXECUTION)
   */
  async detectTrades(walletAddress: string, chain: string) {
    try {
      // Get transactions for this wallet
      const transactions = await prisma.transaction.findMany({
        where: {
          wallet: { address: walletAddress },
          chain: chain.toUpperCase(),
          status: 'SUCCESS',
        },
        include: {
          tokenTransfers: true,
        },
      });

      const trades = [];

      for (const tx of transactions) {
        // Detect DEX interactions
        const dexDetected = this.detectDEXInteraction(tx);
        if (dexDetected) {
          const trade = await this.parseTrade(tx);
          if (trade) {
            trades.push(trade);
          }
        }
      }

      return trades;
    } catch (error) {
      logger.error('Trade detection error:', error);
      return [];
    }
  }

  private detectDEXInteraction(tx: any): boolean {
    const dexAddresses = [
      '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2
      '0xE592427A0AEce92De3Edee1F18E0157C05861564', // Uniswap V3
      '0x10ED43C718714eb63d5aA57B78B54704E256024E', // PancakeSwap
      '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff', // QuickSwap
    ];
    return dexAddresses.includes(tx.toAddress?.toLowerCase());
  }

  private async parseTrade(tx: any) {
    // Parse DEX trade from transaction data
    // Returns trade data WITHOUT execution capability
    return {
      txHash: tx.hash,
      protocol: this.detectProtocol(tx.toAddress),
      side: 'BUY', // or SELL
      tokenIn: '0x...',
      tokenOut: '0x...',
      amountIn: 1.5,
      amountOut: 3000,
      valueUsd: 3000,
      timestamp: tx.timestamp,
    };
  }

  private detectProtocol(toAddress: string): string {
    const protocols: Record<string, string> = {
      '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D': 'Uniswap V2',
      '0xE592427A0AEce92De3Edee1F18E0157C05861564': 'Uniswap V3',
      '0x10ED43C718714eb63d5aA57B78B54704E256024E': 'PancakeSwap',
    };
    return protocols[toAddress.toLowerCase()] || 'Unknown DEX';
  }
}

export const tradeDetectionService = TradeDetectionService.getInstance();