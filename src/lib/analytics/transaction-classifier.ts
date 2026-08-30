// src/lib/analytics/transaction-classifier.ts
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
  metadata: Record<string, any>;
}

export class TransactionClassifier {
  private static instance: TransactionClassifier;
  private dexAddresses: Set<string>;
  private exchangeAddresses: Set<string>;
  private bridgeAddresses: Set<string>;
  private stakingAddresses: Set<string>;

  private constructor() {
    // Known DEX addresses
    this.dexAddresses = new Set([
      '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2
      '0xE592427A0AEce92De3Edee1F18E0157C05861564', // Uniswap V3
      '0x10ED43C718714eb63d5aA57B78B54704E256024E', // PancakeSwap
      '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff', // QuickSwap
      '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F', // SushiSwap
    ]);

    // Known exchange addresses
    this.exchangeAddresses = new Set([
      '0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE', // Binance
      '0x28C6c06298d514Db089934071355E5743bf21d60', // Binance 2
      '0x21a31Ee1afC51d94C2eFcCAaE2d4F66bE0E9Cb4A', // Coinbase
      '0x0aB52FcCb356fC488f499353eDbe1eaeCb523C3E', // OKX
    ]);

    // Known bridges
    this.bridgeAddresses = new Set([
      '0xae2Fc483527B8EF99EB5D9B44875F005ba1FaE13', // Across
      '0x2f2a2543B76A4166549F7aaB2e75B0cA52d2C2A6', // WBTC
      '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff', // Hop
    ]);

    // Known staking contracts
    this.stakingAddresses = new Set([
      '0x0000000000000000000000000000000000000000', // Add actual addresses
    ]);
  }

  static getInstance(): TransactionClassifier {
    if (!TransactionClassifier.instance) {
      TransactionClassifier.instance = new TransactionClassifier();
    }
    return TransactionClassifier.instance;
  }

  classify(
    transaction: any,
    tokenTransfers: any[],
    logs: any[]
  ): ClassificationResult {
    const reasons: string[] = [];
    let confidence = 0;
    let type = TransactionType.UNKNOWN;

    // 1. Check if transaction failed
    if (transaction.status === 'FAILED') {
      return {
        type: TransactionType.UNKNOWN,
        confidence: 0,
        reasons: ['Transaction failed on-chain'],
        metadata: { status: 'FAILED' },
      };
    }

    // 2. Check if DEX interaction
    const isDEX = this.isDEXInteraction(transaction, logs);
    if (isDEX) {
      reasons.push('DEX interaction detected');
      confidence += 30;
      
      const swap = this.parseDEXSwap(transaction, tokenTransfers, logs);
      if (swap) {
        const isBuy = this.isBuyTransaction(transaction, swap);
        type = isBuy ? TransactionType.BUY : TransactionType.SELL;
        reasons.push(isBuy ? 'Tokens entered wallet from DEX' : 'Tokens left wallet via DEX');
        confidence += 40;
        
        return {
          type,
          confidence: Math.min(confidence, 100),
          reasons,
          tokenIn: swap.tokenIn,
          tokenOut: swap.tokenOut,
          amountIn: swap.amountIn,
          amountOut: swap.amountOut,
          valueUsd: swap.valueUsd,
          protocol: swap.protocol,
          side: isBuy ? 'BUY' : 'SELL',
          metadata: {
            txHash: transaction.hash,
            blockNumber: transaction.blockNumber,
            timestamp: transaction.timestamp,
          },
        };
      }
    }

    // 3. Check if exchange deposit/withdrawal
    const isExchange = this.isExchangeInteraction(transaction);
    if (isExchange) {
      type = this.determineExchangeAction(transaction, tokenTransfers);
      reasons.push(`Exchange ${type === TransactionType.EXCHANGE_DEPOSIT ? 'deposit' : 'withdrawal'}`);
      confidence += 30;
      
      return {
        type,
        confidence: Math.min(confidence, 70),
        reasons,
        metadata: {
          txHash: transaction.hash,
          blockNumber: transaction.blockNumber,
          timestamp: transaction.timestamp,
        },
      };
    }

    // 4. Check if bridge
    const isBridge = this.isBridgeInteraction(transaction);
    if (isBridge) {
      return {
        type: TransactionType.BRIDGE,
        confidence: 70,
        reasons: ['Bridge interaction detected'],
        metadata: {
          txHash: transaction.hash,
          blockNumber: transaction.blockNumber,
          timestamp: transaction.timestamp,
        },
      };
    }

    // 5. Check if staking
    const isStake = this.isStakingInteraction(transaction);
    if (isStake) {
      return {
        type: TransactionType.STAKE,
        confidence: 70,
        reasons: ['Staking interaction detected'],
        metadata: {
          txHash: transaction.hash,
          blockNumber: transaction.blockNumber,
          timestamp: transaction.timestamp,
        },
      };
    }

    // 6. Check if simple transfer
    const isTransfer = this.isSimpleTransfer(tokenTransfers);
    if (isTransfer) {
      return {
        type: TransactionType.TRANSFER,
        confidence: 80,
        reasons: ['Simple token transfer between wallets'],
        metadata: {
          txHash: transaction.hash,
          blockNumber: transaction.blockNumber,
          timestamp: transaction.timestamp,
        },
      };
    }

    // 7. Unknown
    return {
      type: TransactionType.UNKNOWN,
      confidence: 0,
      reasons: ['Could not classify transaction confidently'],
      metadata: {
        txHash: transaction.hash,
        blockNumber: transaction.blockNumber,
        timestamp: transaction.timestamp,
      },
    };
  }

  private isDEXInteraction(transaction: any, logs: any[]): boolean {
    // Check if to address is a known DEX
    if (transaction.toAddress && this.dexAddresses.has(transaction.toAddress.toLowerCase())) {
      return true;
    }
    
    // Check if logs contain swap events
    for (const log of logs) {
      if (log.topics && log.topics[0] === '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822') {
        return true; // Swap event
      }
    }
    
    return false;
  }

  private parseDEXSwap(transaction: any, tokenTransfers: any[], logs: any[]) {
    // Implement DEX swap parsing
    // This would parse the actual swap data from logs and transfers
    // Simplified for brevity
    return {
      tokenIn: '0x...',
      tokenOut: '0x...',
      amountIn: 1.5,
      amountOut: 3000,
      valueUsd: 3000,
      protocol: 'Uniswap V2',
    };
  }

  private isBuyTransaction(transaction: any, swap: any): boolean {
    // Determine if wallet is buying or selling
    // Wallet is buying if they receive the token
    const isBuy = swap.tokenOut && swap.tokenOut !== '0x...';
    return isBuy;
  }

  private isExchangeInteraction(transaction: any): boolean {
    return this.exchangeAddresses.has(transaction.toAddress?.toLowerCase());
  }

  private determineExchangeAction(transaction: any, tokenTransfers: any[]): TransactionType {
    // Check if tokens moved from wallet to exchange (deposit) or vice versa
    const walletAddress = transaction.fromAddress;
    const isDeposit = tokenTransfers.some(t => 
      t.fromAddress === walletAddress && this.exchangeAddresses.has(t.toAddress.toLowerCase())
    );
    return isDeposit ? TransactionType.EXCHANGE_DEPOSIT : TransactionType.EXCHANGE_WITHDRAWAL;
  }

  private isBridgeInteraction(transaction: any): boolean {
    return this.bridgeAddresses.has(transaction.toAddress?.toLowerCase());
  }

  private isStakingInteraction(transaction: any): boolean {
    return this.stakingAddresses.has(transaction.toAddress?.toLowerCase());
  }

  private isSimpleTransfer(tokenTransfers: any[]): boolean {
    // Only one transfer, no DEX interaction
    return tokenTransfers.length === 1;
  }
}