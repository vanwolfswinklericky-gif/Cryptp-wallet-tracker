// src/lib/services/zerion.service.ts
import { logger } from '@/lib/logger';

const ZERION_API_KEY = process.env.ZERION_API_KEY;

// Base64 encode the API key for Basic Auth
function getAuthHeader(): string {
  if (!ZERION_API_KEY) {
    throw new Error('ZERION_API_KEY is not set');
  }
  // Basic Auth: username is the API key, password is empty
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
   * Fetch complete wallet portfolio from Zerion
   * Returns tokens with balances and USD values across ALL chains
   */
  async getWalletPortfolio(address: string): Promise<ZerionWalletData> {
    const url = `https://api.zerion.io/v1/wallets/${address}/portfolio?currency=usd`;

    logger.info(`🔍 Fetching Zerion portfolio for ${address}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': getAuthHeader(),
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`❌ Zerion API error ${response.status}:`, errorText);
      throw new Error(`Zerion API error: ${response.statusText}`);
    }

    const data = await response.json();
    const attributes = data.data?.attributes;

    if (!attributes) {
      logger.warn('⚠️ No portfolio data returned from Zerion');
      return this.emptyWalletData(address);
    }

    // Zerion returns aggregated portfolio data
    const totalValue = attributes.total?.positions || 0;
    const changes = attributes.changes || {};

    logger.info(`✅ Zerion portfolio: $${totalValue.toFixed(2)} total value`);

    // Now fetch positions for token details
    const positions = await this.getWalletPositions(address);

    return {
      address,
      chain: 'ethereum', // Zerion aggregates all chains
      balance: 0, // Zerion doesn't return native balance separately
      balanceFormatted: totalValue.toFixed(2),
      symbol: 'USD', // Portfolio value in USD
      transactions: [], // Fetch separately if needed
      transactionsCount: 0,
      tokens: positions,
    };
  }

  /**
   * Fetch token positions (balances + prices) from Zerion
   * This gives you every token with balance > 0, already priced
   */
  async getWalletPositions(address: string): Promise<ZerionPosition[]> {
    const url = `https://api.zerion.io/v1/wallets/${address}/positions/?currency=usd&filter[trash]=only_non_trash&sort=value`;

    logger.info(`🔍 Fetching Zerion positions for ${address}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': getAuthHeader(),
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`❌ Zerion positions error ${response.status}:`, errorText);
      return [];
    }

    const data = await response.json();
    const positions = data.data || [];

    logger.info(`✅ Found ${positions.length} positions`);

    // Transform Zerion format to your expected format
    return positions.map((pos: any) => {
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
  }

  /**
   * Fetch wallet transactions from Zerion
   */
  async getWalletTransactions(address: string, limit: number = 25): Promise<any[]> {
    const url = `https://api.zerion.io/v1/wallets/${address}/transactions/?currency=usd&page[size]=${limit}`;

    logger.info(`🔍 Fetching Zerion transactions for ${address}`);

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