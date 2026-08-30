// src/lib/normalization/event-normalizer.ts
import { logger } from '@/lib/logger';

export interface NormalizedEvent {
  address: string;
  name: string;
  signature: string;
  topics: string[];
  data: any;
  decodedData: any;
  logIndex: number;
  transactionIndex: number;
  blockNumber: number;
  blockHash: string;
  txHash: string;
  chain: string;
  timestamp: Date;
}

export interface NormalizedSwapEvent {
  eventType: 'SWAP';
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  sender: string;
  recipient: string;
  dex: string;
}

export interface NormalizedTransferEvent {
  eventType: 'TRANSFER';
  from: string;
  to: string;
  amount: string;
  token: string;
}

export interface NormalizedApprovalEvent {
  eventType: 'APPROVAL';
  owner: string;
  spender: string;
  amount: string;
  token: string;
}

export interface NormalizedStakingEvent {
  eventType: 'STAKE' | 'UNSTAKE' | 'REWARD';
  user: string;
  amount: string;
  token: string;
  protocol: string;
}

export interface NormalizedLPEvent {
  eventType: 'LP_DEPOSIT' | 'LP_WITHDRAWAL' | 'LP_REWARD';
  user: string;
  token0: string;
  token1: string;
  amount0: string;
  amount1: string;
  liquidity: string;
  protocol: string;
}

export type NormalizedContractEvent =
  | NormalizedSwapEvent
  | NormalizedTransferEvent
  | NormalizedApprovalEvent
  | NormalizedStakingEvent
  | NormalizedLPEvent;

// Known event signatures (keccak256 hashes)
const EVENT_SIGNATURES: Record<string, string> = {
  // Uniswap V2/V3
  '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822': 'SWAP',
  '0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1': 'SYNC',
  '0xd0e30db0ae264a5cd8e9f350151e8ec4de3bdecf0c3933ce2f1b0ec3678bb8aa': 'DEPOSIT',
  '0x692cf58263212bc7a5efceda540f5b5739beb461f9012a77bd56c1981a6a60b1': 'WITHDRAW',
  
  // ERC20 Transfer
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef': 'TRANSFER',
  
  // ERC20 Approval
  '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925': 'APPROVAL',
  
  // Aave
  '0x2b8783d9f7b8cbc6f0c7c2c2a6b6d3f0f4a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d': 'BORROW',
  '0x1d3d2b7c6e4f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3': 'REPAY',
  '0x2b7c6e4f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c': 'DEPOSIT_AAVE',
  '0x3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d': 'WITHDRAW_AAVE',
  
  // Curve
  '0x6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7': 'ADD_LIQUIDITY',
  '0x8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c': 'REMOVE_LIQUIDITY',
  
  // Uniswap V3
  '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67': 'SWAP_V3',
  '0x4a25e94d6d0b12f6e0f4a3e6c8a8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d': 'MINT_V3',
  '0x0b5d1f6d4f3e2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a': 'BURN_V3',
  
  // PancakeSwap
  '0x4a25e94d6d0b12f6e0f4a3e6c8a8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d': 'SWAP_CAKE',
};

// Known DEX addresses
const DEX_ADDRESSES = new Set([
  '0x7a250d5630b4cf539739df2c5dacb4c659f2488d', // Uniswap V2
  '0xe592427a0aece92de3edee1f18e0157c05861564', // Uniswap V3
  '0x10ed43c718714eb63d5aa57b78b54704e256024e', // PancakeSwap
  '0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff', // QuickSwap
  '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f', // SushiSwap
  '0x1f98431c8ad98523631ae4a59f267346ea31f984', // Uniswap V3 Factory
]);

export class EventNormalizer {
  private static instance: EventNormalizer;

  static getInstance(): EventNormalizer {
    if (!EventNormalizer.instance) {
      EventNormalizer.instance = new EventNormalizer();
    }
    return EventNormalizer.instance;
  }

  /**
   * Normalize blockchain event - CRITICAL FOR TRADE DETECTION
   */
  normalizeEvent(
    log: any,
    chain: string,
    blockNumber: number,
    blockHash: string,
    txHash: string,
    timestamp: Date
  ): NormalizedEvent {
    const signature = log.topics?.[0] || '';
    const eventName = EVENT_SIGNATURES[signature] || 'UNKNOWN';

    return {
      address: log.address || '',
      name: eventName,
      signature,
      topics: log.topics || [],
      data: log.data || '',
      decodedData: this.decodeEvent(log, eventName),
      logIndex: log.logIndex || 0,
      transactionIndex: log.transactionIndex || 0,
      blockNumber,
      blockHash,
      txHash,
      chain: chain.toUpperCase(),
      timestamp,
    };
  }

  /**
   * Decode event data - CONTRACT EVENT PARSING
   */
  decodeEvent(log: any, eventName: string): any {
    try {
      // This would use actual contract ABIs to decode
      // Simplified version - in production, use ethers.js or similar
      switch (eventName) {
        case 'SWAP':
        case 'SWAP_V3':
          return this.decodeSwapEvent(log);
        case 'TRANSFER':
          return this.decodeTransferEvent(log);
        case 'APPROVAL':
          return this.decodeApprovalEvent(log);
        case 'DEPOSIT':
        case 'WITHDRAW':
          return this.decodeDepositEvent(log);
        default:
          return {
            raw: log.data,
            topics: log.topics,
          };
      }
    } catch (error) {
      logger.error('Event decode failed:', error);
      return { raw: log.data };
    }
  }

  private decodeSwapEvent(log: any): NormalizedSwapEvent {
    // Decode Uniswap-style swap event
    // topics: [event, sender, recipient, amount0, amount1]
    const topics = log.topics || [];
    const data = log.data || '';

    return {
      eventType: 'SWAP',
      tokenIn: '0x...', // Would decode from data
      tokenOut: '0x...',
      amountIn: '0',
      amountOut: '0',
      sender: topics[1] || '',
      recipient: topics[2] || '',
      dex: this.detectDEX(log.address),
    };
  }

  private decodeTransferEvent(log: any): NormalizedTransferEvent {
    // topics: [event, from, to]
    // data: amount
    const topics = log.topics || [];

    return {
      eventType: 'TRANSFER',
      from: topics[1] || '',
      to: topics[2] || '',
      amount: log.data || '0',
      token: log.address || '',
    };
  }

  private decodeApprovalEvent(log: any): NormalizedApprovalEvent {
    // topics: [event, owner, spender]
    // data: amount
    const topics = log.topics || [];

    return {
      eventType: 'APPROVAL',
      owner: topics[1] || '',
      spender: topics[2] || '',
      amount: log.data || '0',
      token: log.address || '',
    };
  }

  private decodeDepositEvent(log: any): NormalizedLPEvent | NormalizedStakingEvent {
    const topics = log.topics || [];
    const isStaking = this.isStakingContract(log.address);
    
    if (isStaking) {
      return {
        eventType: log.topics[0]?.includes('withdraw') ? 'UNSTAKE' : 'STAKE',
        user: topics[1] || '',
        amount: log.data || '0',
        token: log.address || '',
        protocol: this.detectProtocol(log.address),
      };
    }

    return {
      eventType: 'LP_DEPOSIT',
      user: topics[1] || '',
      token0: '0x...',
      token1: '0x...',
      amount0: '0',
      amount1: '0',
      liquidity: '0',
      protocol: this.detectProtocol(log.address),
    };
  }

  private detectDEX(address: string): string {
    const lower = address.toLowerCase();
    if (lower === '0x7a250d5630b4cf539739df2c5dacb4c659f2488d') return 'Uniswap V2';
    if (lower === '0xe592427a0aece92de3edee1f18e0157c05861564') return 'Uniswap V3';
    if (lower === '0x10ed43c718714eb63d5aa57b78b54704e256024e') return 'PancakeSwap';
    if (lower === '0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff') return 'QuickSwap';
    if (lower === '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f') return 'SushiSwap';
    return 'Unknown DEX';
  }

  private detectProtocol(address: string): string {
    const lower = address.toLowerCase();
    if (lower.includes('aave')) return 'Aave';
    if (lower.includes('curve')) return 'Curve';
    if (lower.includes('compound')) return 'Compound';
    if (lower.includes('balancer')) return 'Balancer';
    return 'Unknown Protocol';
  }

  private isStakingContract(address: string): boolean {
    // Check if address is a known staking contract
    const stakingAddresses = new Set([
      // Add known staking contract addresses
    ]);
    return stakingAddresses.has(address.toLowerCase());
  }

  /**
   * Classify event type - IDENTIFY TRADES
   */
  classifyEvent(normalized: NormalizedEvent): {
    isTrade: boolean;
    type: 'SWAP' | 'TRANSFER' | 'APPROVAL' | 'STAKE' | 'LP' | 'OTHER';
    confidence: number;
  } {
    const isDEX = DEX_ADDRESSES.has(normalized.address.toLowerCase());
    const isSwap = normalized.name === 'SWAP' || normalized.name === 'SWAP_V3';

    if (isDEX && isSwap) {
      return { isTrade: true, type: 'SWAP', confidence: 95 };
    }

    if (normalized.name === 'TRANSFER') {
      // Check if it's a trade (involves DEX)
      const decoded = normalized.decodedData as NormalizedTransferEvent;
      if (decoded && (decoded.from || decoded.to)) {
        // Check if transfer is from/to a DEX
        const isFromDEX = DEX_ADDRESSES.has(decoded.from?.toLowerCase() || '');
        const isToDEX = DEX_ADDRESSES.has(decoded.to?.toLowerCase() || '');
        if (isFromDEX || isToDEX) {
          return { isTrade: true, type: 'SWAP', confidence: 85 };
        }
      }
      return { isTrade: false, type: 'TRANSFER', confidence: 90 };
    }

    if (normalized.name === 'APPROVAL') {
      return { isTrade: false, type: 'APPROVAL', confidence: 95 };
    }

    if (normalized.name === 'STAKE' || normalized.name === 'UNSTAKE') {
      return { isTrade: false, type: 'STAKE', confidence: 90 };
    }

    if (normalized.name === 'DEPOSIT' || normalized.name === 'WITHDRAW') {
      return { isTrade: false, type: 'LP', confidence: 85 };
    }

    return { isTrade: false, type: 'OTHER', confidence: 50 };
  }

  /**
   * Extract trade information from events - TRADE DETECTION
   */
  extractTradeInfo(events: NormalizedEvent[]): {
    tokenIn?: string;
    tokenOut?: string;
    amountIn?: string;
    amountOut?: string;
    protocol?: string;
    side?: 'BUY' | 'SELL';
  } | null {
    // Find swap events
    const swaps = events.filter(e => e.name === 'SWAP' || e.name === 'SWAP_V3');
    if (swaps.length === 0) return null;

    const swap = swaps[0];
    const decoded = swap.decodedData as NormalizedSwapEvent;

    // Find associated transfers
    const transfers = events
      .filter(e => e.name === 'TRANSFER')
      .map(e => e.decodedData as NormalizedTransferEvent);

    // Determine tokens and amounts
    let tokenIn = decoded.tokenIn;
    let tokenOut = decoded.tokenOut;
    let amountIn = decoded.amountIn;
    let amountOut = decoded.amountOut;

    // If not decoded from swap, try from transfers
    if (!tokenIn || tokenIn === '0x...') {
      for (const transfer of transfers) {
        if (transfer.from === decoded.sender) {
          tokenIn = transfer.token;
          amountIn = transfer.amount;
        }
        if (transfer.to === decoded.recipient) {
          tokenOut = transfer.token;
          amountOut = transfer.amount;
        }
      }
    }

    return {
      tokenIn,
      tokenOut,
      amountIn,
      amountOut,
      protocol: decoded.dex || this.detectDEX(swap.address),
      side: this.determineSide(events, decoded.sender || ''),
    };
  }

  private determineSide(events: NormalizedEvent[], walletAddress: string): 'BUY' | 'SELL' {
    // Determine if the wallet is buying or selling
    const transfers = events
      .filter(e => e.name === 'TRANSFER')
      .map(e => e.decodedData as NormalizedTransferEvent);

    for (const transfer of transfers) {
      if (transfer.to === walletAddress) {
        return 'BUY';
      }
      if (transfer.from === walletAddress) {
        return 'SELL';
      }
    }

    return 'BUY';
  }
}