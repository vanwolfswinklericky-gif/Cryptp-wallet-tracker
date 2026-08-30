// src/lib/analytics/transaction-classifier.ts
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { EventNormalizer, NormalizedEvent } from '@/lib/normalization/event-normalizer';

export enum TransactionType {
  BUY = 'BUY',
  SELL = 'SELL',
  SWAP = 'SWAP',
  TRANSFER = 'TRANSFER',
  BRIDGE = 'BRIDGE',
  STAKE = 'STAKE',
  UNSTAKE = 'UNSTAKE',
  LP_DEPOSIT = 'LP_DEPOSIT',
  LP_WITHDRAWAL = 'LP_WITHDRAWAL',
  EXCHANGE_DEPOSIT = 'EXCHANGE_DEPOSIT',
  EXCHANGE_WITHDRAWAL = 'EXCHANGE_WITHDRAWAL',
  AIRDROP = 'AIRDROP',
  CLAIM = 'CLAIM',
  APPROVAL = 'APPROVAL',
  MEV = 'MEV',
  UNKNOWN = 'UNKNOWN',
}

export interface ClassificationResult {
  type: TransactionType;
  confidence: number;
  reasons: string[];
  tokenIn?: string;
  tokenOut?: string;
  amountIn?: number;
  amountOut?: number;
  valueUsd?: number;
  protocol?: string;
  side?: 'BUY' | 'SELL';
  events: NormalizedEvent[];
  metadata: {
    txHash: string;
    blockNumber: number;
    timestamp: Date;
    [key: string]: any;
  };
}

export class TransactionClassifier {
  private static instance: TransactionClassifier;
  private eventNormalizer: EventNormalizer;

  // Known DEX addresses
  private dexAddresses: Set<string>;
  private exchangeAddresses: Set<string>;
  private bridgeAddresses: Set<string>;
  private stakingAddresses: Set<string>;

  private constructor() {
    this.eventNormalizer = EventNormalizer.getInstance();

    // Initialize known addresses
    this.dexAddresses = new Set([
      '0x7a250d5630b4cf539739df2c5dacb4c659f2488d', // Uniswap V2
      '0xe592427a0aece92de3edee1f18e0157c05861564', // Uniswap V3
      '0x10ed43c718714eb63d5aa57b78b54704e256024e', // PancakeSwap
      '0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff', // QuickSwap
      '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f', // SushiSwap
      '0x1f98431c8ad98523631ae4a59f267346ea31f984', // Uniswap V3 Factory
    ]);

    this.exchangeAddresses = new Set([
      '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be', // Binance
      '0x28c6c06298d514db089934071355e5743bf21d60', // Binance 2
      '0x21a31ee1afc51d94c2efccaa e2d4f66be0e9cb4a', // Coinbase
    ]);

    this.bridgeAddresses = new Set([
      '0xae2fc483527b8ef99eb5d9b44875f005ba1fae13', // Across
      '0x2f2a2543b76a4166549f7aab2e75b0ca52d2c2a6', // WBTC
    ]);

    this.stakingAddresses = new Set([
      // Add staking contract addresses
    ]);
  }

  static getInstance(): TransactionClassifier {
    if (!TransactionClassifier.instance) {
      TransactionClassifier.instance = new TransactionClassifier();
    }
    return TransactionClassifier.instance;
  }

  /**
   * Classify transaction using events - COMPLETE PICTURE
   */
  classify(
    txHash: string,
    chain: string,
    fromAddress: string,
    toAddress: string,
    timestamp: Date,
    blockNumber: number,
    logs: any[],
    tokenTransfers: any[],
    status: string
  ): ClassificationResult {
    const reasons: string[] = [];
    let confidence = 0;
    let type = TransactionType.UNKNOWN;

    // 1. Check if transaction failed
    if (status === 'FAILED') {
      return {
        type: TransactionType.UNKNOWN,
        confidence: 0,
        reasons: ['Transaction failed on-chain'],
        events: [],
        metadata: { txHash, blockNumber, timestamp, status: 'FAILED' },
      };
    }

    // 2. Normalize events
    const normalizedEvents = logs.map(log =>
      this.eventNormalizer.normalizeEvent(
        log,
        chain,
        blockNumber,
        '', // blockHash
        txHash,
        timestamp
      )
    );

    // 3. Classify events
    const eventResults = normalizedEvents.map(e =>
      this.eventNormalizer.classifyEvent(e)
    );

    // 4. Check if any events indicate a trade
    const hasTrade = eventResults.some(r => r.isTrade);

    if (hasTrade) {
      reasons.push('Trade event detected');
      confidence += 40;

      // Extract trade info
      const tradeInfo = this.eventNormalizer.extractTradeInfo(normalizedEvents);
      
      if (tradeInfo) {
        const isBuy = tradeInfo.side === 'BUY';
        type = isBuy ? TransactionType.BUY : TransactionType.SELL;
        reasons.push(isBuy ? 'Buy side detected' : 'Sell side detected');
        confidence += 30;

        // Check if it's a swap
        const swapEvents = eventResults.filter(r => r.type === 'SWAP');
        if (swapEvents.length > 0) {
          type = TransactionType.SWAP;
          reasons.push('Swap detected');
          confidence += 10;
        }

        return {
          type,
          confidence: Math.min(confidence, 100),
          reasons,
          tokenIn: tradeInfo.tokenIn,
          tokenOut: tradeInfo.tokenOut,
          amountIn: parseFloat(tradeInfo.amountIn || '0'),
          amountOut: parseFloat(tradeInfo.amountOut || '0'),
          protocol: tradeInfo.protocol,
          side: tradeInfo.side,
          events: normalizedEvents,
          metadata: { txHash, blockNumber, timestamp },
        };
      }
    }

    // 5. Check if exchange deposit/withdrawal
    const isExchange = this.isExchangeInteraction(toAddress);
    if (isExchange) {
      type = this.determineExchangeAction(fromAddress, tokenTransfers);
      reasons.push(`Exchange ${type === TransactionType.EXCHANGE_DEPOSIT ? 'deposit' : 'withdrawal'}`);
      confidence += 30;
      
      return {
        type,
        confidence: Math.min(confidence, 70),
        reasons,
        events: normalizedEvents,
        metadata: { txHash, blockNumber, timestamp },
      };
    }

    // 6. Check if bridge
    const isBridge = this.isBridgeInteraction(toAddress);
    if (isBridge) {
      return {
        type: TransactionType.BRIDGE,
        confidence: 70,
        reasons: ['Bridge interaction detected'],
        events: normalizedEvents,
        metadata: { txHash, blockNumber, timestamp },
      };
    }

    // 7. Check if staking
    const isStake = this.isStakingInteraction(toAddress);
    if (isStake) {
      return {
        type: TransactionType.STAKE,
        confidence: 70,
        reasons: ['Staking interaction detected'],
        events: normalizedEvents,
        metadata: { txHash, blockNumber, timestamp },
      };
    }

    // 8. Check if simple transfer
    const isTransfer = this.isSimpleTransfer(tokenTransfers);
    if (isTransfer) {
      return {
        type: TransactionType.TRANSFER,
        confidence: 80,
        reasons: ['Simple token transfer between wallets'],
        events: normalizedEvents,
        metadata: { txHash, blockNumber, timestamp },
      };
    }

    // 9. Check if approval
    const isApproval = eventResults.some(r => r.type === 'APPROVAL');
    if (isApproval) {
      return {
        type: TransactionType.APPROVAL,
        confidence: 85,
        reasons: ['Token approval'],
        events: normalizedEvents,
        metadata: { txHash, blockNumber, timestamp },
      };
    }

    // 10. AMBIGUOUS - Store for review
    reasons.push('Ambiguous transaction - requires review');
    return {
      type: TransactionType.UNKNOWN,
      confidence: 0,
      reasons,
      events: normalizedEvents,
      metadata: { txHash, blockNumber, timestamp, requiresReview: true },
    };
  }

  private isExchangeInteraction(toAddress: string): boolean {
    return toAddress && this.exchangeAddresses.has(toAddress.toLowerCase());
  }

  private determineExchangeAction(walletAddress: string, tokenTransfers: any[]): TransactionType {
    for (const transfer of tokenTransfers) {
      if (transfer.fromAddress === walletAddress) {
        return TransactionType.EXCHANGE_DEPOSIT;
      }
      if (transfer.toAddress === walletAddress) {
        return TransactionType.EXCHANGE_WITHDRAWAL;
      }
    }
    return TransactionType.EXCHANGE_DEPOSIT;
  }

  private isBridgeInteraction(toAddress: string): boolean {
    return toAddress && this.bridgeAddresses.has(toAddress.toLowerCase());
  }

  private isStakingInteraction(toAddress: string): boolean {
    return toAddress && this.stakingAddresses.has(toAddress.toLowerCase());
  }

  private isSimpleTransfer(tokenTransfers: any[]): boolean {
    return tokenTransfers.length === 1;
  }
}