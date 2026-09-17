// src/lib/services/zerion.service.ts
import { logger } from '@/lib/logger';

const ZERION_API_KEY = process.env.ZERION_API_KEY;

function getAuthHeader(): string {
  if (!ZERION_API_KEY) throw new Error('ZERION_API_KEY is not set');
  return `Basic ${Buffer.from(`${ZERION_API_KEY}:`).toString('base64')}`;
}

export interface ZerionPosition {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  balance: string;
  decimals: number;
  formatted: string;
  valueUsd?: number;
}

export interface ZerionWalletData {
  address: string;
  chain: string;
  balance: number;
  balanceFormatted: string;
  symbol: string;
  transactions: any[];
  transactionsCount: number;
  tokens: ZerionPosition[];
}

export class ZerionService {
  private static instance: ZerionService;

  static getInstance(): ZerionService {
    if (!ZerionService.instance) {
      ZerionService.instance = new ZerionService();
    }
    return ZerionService.instance;
  }

  /**
   * ✅ Fetch complete wallet data in ONE call
   * Returns: portfolio value + positions (tokens with prices)
   */
  async getWalletPortfolio(address: string): Promise<ZerionWalletData> {
    const url = `https://api.zerion.io/v1/wallets/${address}/positions/?currency=usd&filter[trash]=only_non_trash&sort=value`;

    logger.info(`🔍 Fetching Zerion portfolio+positions for ${address}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': getAuthHeader(),
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`❌ Zerion API error ${response.status}:`, errorText.slice(0, 200));
      return this.emptyWalletData(address);
    }

    const data = await response.json();
    const positions = data.data || [];

    // Transform Zerion positions to our format
    const tokens: ZerionPosition[] = positions.map((pos: any) => {
      const attrs = pos.attributes;
      const fungible = attrs.fungible_info;
      const impl = fungible?.implementations?.[0] || {};

      return {
        tokenAddress: impl.address || '',
        tokenSymbol: fungible?.symbol || 'UNKNOWN',
        tokenName: fungible?.name || 'Unknown Token',
        balance: attrs.quantity?.int || '0',
        decimals: impl.decimals || 18,
        formatted: attrs.quantity?.float?.toString() || '0',
        valueUsd: attrs.value || 0,
      };
    });

    // Calculate total value
    const totalValue = tokens.reduce((sum, t) => sum + (t.valueUsd || 0), 0);

    logger.info(`✅ Zerion: ${tokens.length} positions, $${totalValue.toFixed(2)} total`);

    return {
      address,
      chain: 'ethereum',
      balance: totalValue,
      balanceFormatted: totalValue.toFixed(2),
      symbol: 'USD',
      transactions: [],
      transactionsCount: 0,
      tokens,
    };
  }

  /**
   * ✅ Fetch wallet transactions (separate call, optional)
   */
  async getWalletTransactions(address: string, limit: number = 25): Promise<any[]> {
    const url = `https://api.zerion.io/v1/wallets/${address}/transactions/?currency=usd&page[size]=${limit}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': getAuthHeader(),
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      logger.warn(`⚠️ Zerion transactions failed: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.data || [];
  }

  private emptyWalletData(address: string): ZerionWalletData {
    return {
      address,
      chain: 'ethereum',
      balance: 0,
      balanceFormatted: '0.00',
      symbol: 'USD',
      transactions: [],
      transactionsCount: 0,
      tokens: [],
    };
  }
}

export const zerionService = ZerionService.getInstance();