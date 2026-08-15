// src/lib/api/scanner.ts
import { prisma } from '@/lib/db/prisma';
import { redis } from '@/lib/db/redis';

export interface ScannerFilters {
  minPnL?: number;
  maxPnL?: number;
  minWinRate?: number;
  minTrades?: number;
  minPerformance?: number;
  maxDrawdown?: number;
  minWalletScore?: number;
  chains?: string[];
  tokens?: string[];
  protocols?: string[];
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'walletScore' | 'pnl' | 'roi' | 'winRate' | 'tradeCount' | 'volume';
  sortOrder?: 'asc' | 'desc';
}

export interface WalletMetrics {
  address: string;
  chain: string;
  pnl: number;
  roi: number;
  winRate: number;
  tradeCount: number;
  averageTrade: number;
  volume: number;
  drawdown: number;
  walletScore: number;
  chains: string[];
  preferredTokens: string[];
  preferredProtocols: string[];
  performance24h?: number;
  performance7d?: number;
  performance30d?: number;
  performance90d?: number;
  portfolioValue?: number;
  lastTrade?: string;
  firstTrade?: string;
  activeDays?: number;
}

export interface ScannerResult {
  wallets: WalletMetrics[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export class ScannerAPI {
  private static instance: ScannerAPI;

  private constructor() {}

  static getInstance(): ScannerAPI {
    if (!ScannerAPI.instance) {
      ScannerAPI.instance = new ScannerAPI();
    }
    return ScannerAPI.instance;
  }

  /**
   * Get wallets with advanced filtering
   */
  async getWallets(filters: ScannerFilters): Promise<ScannerResult> {
    const cacheKey = this.getCacheKey('wallets', filters);
    
    // Check cache
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.log('✅ Scanner cache hit');
        return JSON.parse(cached as string);
      }
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    const sortBy = filters.sortBy || 'walletScore';
    const sortOrder = filters.sortOrder || 'desc';

    try {
      // Build the query
      const whereConditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // Apply filters
      if (filters.minPnL !== undefined) {
        whereConditions.push(`m.total_pnl >= $${paramIndex++}`);
        params.push(filters.minPnL);
      }
      if (filters.maxPnL !== undefined) {
        whereConditions.push(`m.total_pnl <= $${paramIndex++}`);
        params.push(filters.maxPnL);
      }
      if (filters.minWinRate !== undefined) {
        whereConditions.push(`m.win_rate >= $${paramIndex++}`);
        params.push(filters.minWinRate);
      }
      if (filters.minTrades !== undefined) {
        whereConditions.push(`m.trade_count >= $${paramIndex++}`);
        params.push(filters.minTrades);
      }
      if (filters.minPerformance !== undefined) {
        whereConditions.push(`m.performance_90d >= $${paramIndex++}`);
        params.push(filters.minPerformance);
      }
      if (filters.maxDrawdown !== undefined) {
        whereConditions.push(`m.max_drawdown <= $${paramIndex++}`);
        params.push(filters.maxDrawdown);
      }
      if (filters.minWalletScore !== undefined) {
        whereConditions.push(`m.wallet_score >= $${paramIndex++}`);
        params.push(filters.minWalletScore);
      }
      if (filters.chains && filters.chains.length > 0) {
        whereConditions.push(`m.chain = ANY($${paramIndex++})`);
        params.push(filters.chains);
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      // Build the query
      const query = `
        SELECT DISTINCT ON (w.address, m.chain)
          w.address,
          m.chain,
          m.total_pnl as pnl,
          m.total_roi as roi,
          m.win_rate as winRate,
          m.trade_count as tradeCount,
          m.average_trade as averageTrade,
          m.total_volume as volume,
          m.max_drawdown as drawdown,
          m.wallet_score as walletScore,
          m.performance_24h as performance24h,
          m.performance_7d as performance7d,
          m.performance_30d as performance30d,
          m.performance_90d as performance90d,
          m.portfolio_value as portfolioValue,
          m.active_days as activeDays,
          m.last_trade as lastTrade,
          m.first_trade as firstTrade,
          m.preferred_tokens as preferredTokens,
          m.preferred_protocols as preferredProtocols,
          COUNT(*) OVER() as total_count
        FROM wallet_metrics m
        JOIN wallets w ON w.id = m.wallet_id
        ${whereClause}
        ORDER BY w.address, m.chain, m.timestamp DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;

      params.push(limit, offset);

      // Execute query
      const results = await prisma.$queryRawUnsafe(query, ...params) as any[];

      // Get total count
      const total = results.length > 0 ? Number(results[0].total_count) : 0;

      // Format results
      const wallets = results.map((row: any) => ({
        address: row.address,
        chain: row.chain,
        pnl: Number(row.pnl) || 0,
        roi: Number(row.roi) || 0,
        winRate: Number(row.winRate) || 0,
        tradeCount: Number(row.tradeCount) || 0,
        averageTrade: Number(row.averageTrade) || 0,
        volume: Number(row.volume) || 0,
        drawdown: Number(row.drawdown) || 0,
        walletScore: Number(row.walletScore) || 0,
        chains: [row.chain],
        preferredTokens: row.preferredtokens || [],
        preferredProtocols: row.preferredprotocols || [],
        performance24h: Number(row.performance24h) || 0,
        performance7d: Number(row.performance7d) || 0,
        performance30d: Number(row.performance30d) || 0,
        performance90d: Number(row.performance90d) || 0,
        portfolioValue: Number(row.portfolioValue) || 0,
        activeDays: Number(row.activeDays) || 0,
        lastTrade: row.lastTrade,
        firstTrade: row.firstTrade,
      }));

      // Sort results (since we're using DISTINCT ON, we need to sort in JS)
      wallets.sort((a, b) => {
        const aVal = a[sortBy as keyof WalletMetrics] || 0;
        const bVal = b[sortBy as keyof WalletMetrics] || 0;
        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
      });

      const result: ScannerResult = {
        wallets,
        total,
        page: Math.floor(offset / limit) + 1,
        limit,
        hasMore: offset + limit < total,
      };

      // Cache results
      if (redis) {
        await redis.set(cacheKey, JSON.stringify(result), { ex: 120 });
      }

      return result;
    } catch (error) {
      console.error('❌ Scanner query error:', error);
      throw error;
    }
  }

  /**
   * Get trending wallets
   */
  async getTrendingWallets(limit: number = 20): Promise<WalletMetrics[]> {
    const cacheKey = 'scanner:trending';
    
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached as string);
      }
    }

    try {
      const results = await prisma.$queryRaw`
        SELECT DISTINCT ON (w.address)
          w.address,
          m.chain,
          m.total_pnl as pnl,
          m.total_roi as roi,
          m.win_rate as winRate,
          m.trade_count as tradeCount,
          m.average_trade as averageTrade,
          m.total_volume as volume,
          m.max_drawdown as drawdown,
          m.wallet_score as walletScore,
          m.performance_7d as performance7d,
          m.preferred_tokens as preferredTokens,
          m.preferred_protocols as preferredProtocols
        FROM wallet_metrics m
        JOIN wallets w ON w.id = m.wallet_id
        WHERE m.performance_7d > 10
          AND m.trade_count > 5
        ORDER BY w.address, m.performance_7d DESC
        LIMIT ${limit}
      `;

      const wallets = (results as any[]).map((row: any) => ({
        address: row.address,
        chain: row.chain,
        pnl: Number(row.pnl) || 0,
        roi: Number(row.roi) || 0,
        winRate: Number(row.winRate) || 0,
        tradeCount: Number(row.tradeCount) || 0,
        averageTrade: Number(row.averageTrade) || 0,
        volume: Number(row.volume) || 0,
        drawdown: Number(row.drawdown) || 0,
        walletScore: Number(row.walletScore) || 0,
        chains: [row.chain],
        preferredTokens: row.preferredtokens || [],
        preferredProtocols: row.preferredprotocols || [],
        performance7d: Number(row.performance7d) || 0,
      }));

      // Sort by 7d performance
      wallets.sort((a, b) => b.performance7d - a.performance7d);

      if (redis) {
        await redis.set(cacheKey, JSON.stringify(wallets), { ex: 300 });
      }

      return wallets;
    } catch (error) {
      console.error('❌ Trending query error:', error);
      throw error;
    }
  }

  /**
   * Get top performers
   */
  async getTopPerformers(
    timeframe: '24h' | '7d' | '30d' | '90d' = '30d',
    limit: number = 20
  ): Promise<WalletMetrics[]> {
    const cacheKey = `scanner:top:${timeframe}`;
    
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached as string);
      }
    }

    const performanceField = 
      timeframe === '24h' ? 'performance_24h' :
      timeframe === '7d' ? 'performance_7d' :
      timeframe === '30d' ? 'performance_30d' :
      'performance_90d';

    try {
      const results = await prisma.$queryRaw`
        SELECT DISTINCT ON (w.address)
          w.address,
          m.chain,
          m.total_pnl as pnl,
          m.total_roi as roi,
          m.win_rate as winRate,
          m.trade_count as tradeCount,
          m.average_trade as averageTrade,
          m.total_volume as volume,
          m.max_drawdown as drawdown,
          m.wallet_score as walletScore,
          m.${raw(performanceField)} as performance,
          m.preferred_tokens as preferredTokens,
          m.preferred_protocols as preferredProtocols
        FROM wallet_metrics m
        JOIN wallets w ON w.id = m.wallet_id
        WHERE m.trade_count > 10
        ORDER BY w.address, m.${raw(performanceField)} DESC
        LIMIT ${limit}
      `;

      const wallets = (results as any[]).map((row: any) => ({
        address: row.address,
        chain: row.chain,
        pnl: Number(row.pnl) || 0,
        roi: Number(row.roi) || 0,
        winRate: Number(row.winRate) || 0,
        tradeCount: Number(row.tradeCount) || 0,
        averageTrade: Number(row.averageTrade) || 0,
        volume: Number(row.volume) || 0,
        drawdown: Number(row.drawdown) || 0,
        walletScore: Number(row.walletScore) || 0,
        chains: [row.chain],
        preferredTokens: row.preferredtokens || [],
        preferredProtocols: row.preferredprotocols || [],
        performance: Number(row.performance) || 0,
      }));

      // Sort by performance
      wallets.sort((a, b) => b.performance - a.performance);

      if (redis) {
        await redis.set(cacheKey, JSON.stringify(wallets), { ex: 300 });
      }

      return wallets;
    } catch (error) {
      console.error('❌ Top performers query error:', error);
      throw error;
    }
  }

  /**
   * Get whale wallets (high portfolio value)
   */
  async getWhales(limit: number = 20): Promise<WalletMetrics[]> {
    const cacheKey = 'scanner:whales';
    
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached as string);
      }
    }

    try {
      const results = await prisma.$queryRaw`
        SELECT DISTINCT ON (w.address)
          w.address,
          m.chain,
          m.total_pnl as pnl,
          m.total_roi as roi,
          m.win_rate as winRate,
          m.trade_count as tradeCount,
          m.average_trade as averageTrade,
          m.total_volume as volume,
          m.max_drawdown as drawdown,
          m.wallet_score as walletScore,
          m.portfolio_value as portfolioValue,
          m.preferred_tokens as preferredTokens,
          m.preferred_protocols as preferredProtocols
        FROM wallet_metrics m
        JOIN wallets w ON w.id = m.wallet_id
        WHERE m.portfolio_value > 100000
        ORDER BY w.address, m.portfolio_value DESC
        LIMIT ${limit}
      `;

      const wallets = (results as any[]).map((row: any) => ({
        address: row.address,
        chain: row.chain,
        pnl: Number(row.pnl) || 0,
        roi: Number(row.roi) || 0,
        winRate: Number(row.winRate) || 0,
        tradeCount: Number(row.tradeCount) || 0,
        averageTrade: Number(row.averageTrade) || 0,
        volume: Number(row.volume) || 0,
        drawdown: Number(row.drawdown) || 0,
        walletScore: Number(row.walletScore) || 0,
        chains: [row.chain],
        preferredTokens: row.preferredtokens || [],
        preferredProtocols: row.preferredprotocols || [],
        portfolioValue: Number(row.portfolioValue) || 0,
      }));

      // Sort by portfolio value
      wallets.sort((a, b) => b.portfolioValue - a.portfolioValue);

      if (redis) {
        await redis.set(cacheKey, JSON.stringify(wallets), { ex: 300 });
      }

      return wallets;
    } catch (error) {
      console.error('❌ Whales query error:', error);
      throw error;
    }
  }

  /**
   * Get smart money wallets (high score, low drawdown, consistent)
   */
  async getSmartMoney(limit: number = 20): Promise<WalletMetrics[]> {
    const cacheKey = 'scanner:smart-money';
    
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached as string);
      }
    }

    try {
      const results = await prisma.$queryRaw`
        SELECT DISTINCT ON (w.address)
          w.address,
          m.chain,
          m.total_pnl as pnl,
          m.total_roi as roi,
          m.win_rate as winRate,
          m.trade_count as tradeCount,
          m.average_trade as averageTrade,
          m.total_volume as volume,
          m.max_drawdown as drawdown,
          m.wallet_score as walletScore,
          m.performance_7d as performance7d,
          m.performance_30d as performance30d,
          m.preferred_tokens as preferredTokens,
          m.preferred_protocols as preferredProtocols
        FROM wallet_metrics m
        JOIN wallets w ON w.id = m.wallet_id
        WHERE m.wallet_score > 80
          AND m.win_rate > 55
          AND m.max_drawdown < 20
          AND m.trade_count > 20
        ORDER BY w.address, m.wallet_score DESC
        LIMIT ${limit}
      `;

      const wallets = (results as any[]).map((row: any) => ({
        address: row.address,
        chain: row.chain,
        pnl: Number(row.pnl) || 0,
        roi: Number(row.roi) || 0,
        winRate: Number(row.winRate) || 0,
        tradeCount: Number(row.tradeCount) || 0,
        averageTrade: Number(row.averageTrade) || 0,
        volume: Number(row.volume) || 0,
        drawdown: Number(row.drawdown) || 0,
        walletScore: Number(row.walletScore) || 0,
        chains: [row.chain],
        preferredTokens: row.preferredtokens || [],
        preferredProtocols: row.preferredprotocols || [],
        performance7d: Number(row.performance7d) || 0,
        performance30d: Number(row.performance30d) || 0,
      }));

      // Sort by wallet score
      wallets.sort((a, b) => b.walletScore - a.walletScore);

      if (redis) {
        await redis.set(cacheKey, JSON.stringify(wallets), { ex: 300 });
      }

      return wallets;
    } catch (error) {
      console.error('❌ Smart money query error:', error);
      throw error;
    }
  }

  /**
   * Generate cache key
   */
  private getCacheKey(type: string, filters: any): string {
    const sorted = Object.keys(filters)
      .sort()
      .reduce((acc: any, key) => {
        if (filters[key] !== undefined && filters[key] !== null) {
          acc[key] = filters[key];
        }
        return acc;
      }, {});
    return `scanner:${type}:${JSON.stringify(sorted)}`;
  }

  /**
   * Clear cache for a specific type
   */
  async clearCache(type?: 'wallets' | 'trending' | 'top' | 'whales' | 'smart-money'): Promise<void> {
    if (!redis) return;

    if (type) {
      await redis.del(`scanner:${type}:*`);
    } else {
      // Clear all scanner cache
      const keys = await redis.keys('scanner:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
    console.log(`🗑️ Cache cleared for scanner${type ? ` (${type})` : ''}`);
  }
}

export const scannerAPI = ScannerAPI.getInstance();