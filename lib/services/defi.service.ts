// lib/services/defi.service.ts
import { cache } from '@/lib/cache';
import { PriceService } from './price.service';

export interface DeFiPosition {
  protocol: string;
  type: 'lending' | 'staking' | 'liquidity' | 'yield' | 'vault';
  asset: string;
  amount: number;
  value: number;
  apy?: number;
  rewards?: { asset: string; amount: number; value: number }[];
  lockedUntil?: string;
  contractAddress: string;
  chain: string;
}

export interface DeFiSummary {
  totalValue: number;
  protocols: string[];
  positions: number;
  apy: number;
  rewards: number;
}

export class DeFiService {
  private static instance: DeFiService;
  private priceService = PriceService.getInstance();

  private constructor() {}

  static getInstance(): DeFiService {
    if (!DeFiService.instance) {
      DeFiService.instance = new DeFiService();
    }
    return DeFiService.instance;
  }

  async getDeFiPositions(
    address: string,
    chain: string,
    protocol?: string
  ): Promise<DeFiPosition[]> {
    // This would integrate with DeFi protocols
    // For now, return sample data
    const positions: DeFiPosition[] = [
      {
        protocol: 'Aave',
        type: 'lending',
        asset: 'USDC',
        amount: 1000,
        value: 1000,
        apy: 3.5,
        rewards: [
          { asset: 'AAVE', amount: 0.05, value: 5 },
        ],
        contractAddress: '0x...',
        chain,
      },
      {
        protocol: 'Lido',
        type: 'staking',
        asset: 'ETH',
        amount: 0.5,
        value: 1600,
        apy: 4.2,
        rewards: [
          { asset: 'stETH', amount: 0.5, value: 1600 },
        ],
        contractAddress: '0x...',
        chain,
      },
    ];

    // Filter by protocol if specified
    const filtered = protocol
      ? positions.filter(p => p.protocol.toLowerCase() === protocol.toLowerCase())
      : positions;

    // Update prices
    const symbols = filtered.map(p => p.asset);
    const prices = await this.priceService.getPrices(symbols);
    
    return filtered.map(p => ({
      ...p,
      value: p.amount * (prices[p.asset] || 1),
    }));
  }

  calculatePositionSummary(positions: DeFiPosition[]): DeFiSummary {
    const totalValue = positions.reduce((sum, p) => sum + p.value, 0);
    const protocols = [...new Set(positions.map(p => p.protocol))];
    const totalRewards = positions.reduce(
      (sum, p) => sum + (p.rewards?.reduce((s, r) => s + r.value, 0) || 0),
      0
    );
    const avgApy = positions.reduce((sum, p) => sum + (p.apy || 0), 0) / positions.length || 0;

    return {
      totalValue,
      protocols,
      positions: positions.length,
      apy: avgApy,
      rewards: totalRewards,
    };
  }
}