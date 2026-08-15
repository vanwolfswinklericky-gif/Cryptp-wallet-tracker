// src/lib/analytics/wallet-analyzer.ts
import { prisma } from '@/lib/db/prisma';
import { redis } from '@/lib/db/redis';

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
}

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
}

export class WalletAnalyzer {
  private static instance: WalletAnalyzer;

  private constructor() {}

  static getInstance(): WalletAnalyzer {
    if (!WalletAnalyzer.instance) {
      WalletAnalyzer.instance = new WalletAnalyzer();
    }
    return WalletAnalyzer.instance;
  }

  async scanWallets(filters: ScannerFilters): Promise<WalletMetrics[]> {
    const cacheKey = this.getCacheKey(filters);
    
    // Check cache
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.log('✅ Cache hit for scanner:', cacheKey);
        return JSON.parse(cached as string);
      }
    }

    console.log('🔍 Scanning wallets with filters:', filters);

    try {
      const results = await this.executeScan(filters);
      
      // Cache results
      if (redis) {
        await redis.set(cacheKey, JSON.stringify(results), { ex: 300 }); // 5 minutes
      }
      
      return results;
    } catch (error) {
      console.error('❌ Scanner error:', error);
      throw error;
    }
  }

  private async executeScan(filters: ScannerFilters): Promise<WalletMetrics[]> {
    const where: any = {};
    const orderBy: any = {};

    // Build where clause
    if (filters.minPnL !== undefined) {
      where.totalPnl = { gte: filters.minPnL };
    }
    if (filters.maxPnL !== undefined) {
      where.totalPnl = { ...where.totalPnl, lte: filters.maxPnL };
    }
    if (filters.minWinRate !== undefined) {
      where.winRate = { gte: filters.minWinRate };
    }
    if (filters.minTrades !== undefined) {
      where.tradeCount = { gte: filters.minTrades };
    }
    if (filters.minPerformance !== undefined) {
      where.performance90d = { gte: filters.minPerformance };
    }
    if (filters.maxDrawdown !== undefined) {
      where.maxDrawdown = { lte: filters.maxDrawdown };
    }
    if (filters.minWalletScore !== undefined) {
      where.walletScore = { gte: filters.minWalletScore };
    }

    // Chain filter
    if (filters.chains && filters.chains.length > 0) {
      where.chain = { in: filters.chains };
    }

    // Get latest metrics for each wallet
    const metrics = await prisma.$queryRaw`
      SELECT DISTINCT ON (w.address, m.chain)
        w.address,
        w.chain,
        m.total_pnl as pnl,
        m.total_roi as roi,
        m.win_rate as winRate,
        m.trade_count as tradeCount,
        m.average_trade as averageTrade,
        m.total_volume as volume,
        m.max_drawdown as drawdown,
        m.wallet_score as walletScore,
        m.preferred_tokens as preferredTokens,
        m.preferred_protocols as preferredProtocols,
        m.performance_7d as performance7d,
        m.performance_30d as performance30d,
        m.performance_90d as performance90d
      FROM wallet_metrics m
      JOIN wallets w ON w.id = m.wallet_id
      WHERE m.timestamp = (
        SELECT MAX(timestamp) 
        FROM wallet_metrics m2 
        WHERE m2.wallet_id = m.wallet_id 
        AND m2.chain = m.chain
      )
      ${filters.chains && filters.chains.length > 0 ? `AND m.chain IN (${filters.chains.map(c => `'${c}'`).join(',')})` : ''}
      ORDER BY w.address, m.chain, m.timestamp DESC
    `;

    // Filter by preferred tokens and protocols (handled in application layer)
    let results = metrics as any[];
    
    if (filters.tokens && filters.tokens.length > 0) {
      results = results.filter((m: any) => 
        m.preferredtokens && m.preferredtokens.some((t: string) => 
          filters.tokens!.includes(t)
        )
      );
    }
    
    if (filters.protocols && filters.protocols.length > 0) {
      results = results.filter((m: any) => 
        m.preferredprotocols && m.preferredprotocols.some((p: string) => 
          filters.protocols!.includes(p)
        )
      );
    }

    // Sort by wallet score
    results.sort((a: any, b: any) => b.walletScore - a.walletScore);

    return results.map((m: any) => ({
      address: m.address,
      chain: m.chain,
      pnl: Number(m.pnl),
      roi: Number(m.roi),
      winRate: Number(m.winRate),
      tradeCount: Number(m.tradeCount),
      averageTrade: Number(m.averageTrade),
      volume: Number(m.volume),
      drawdown: Number(m.drawdown),
      walletScore: Number(m.walletScore),
      chains: [m.chain],
      preferredTokens: m.preferredtokens || [],
      preferredProtocols: m.preferredprotocols || [],
    }));
  }

  private getCacheKey(filters: ScannerFilters): string {
    const sorted = Object.keys(filters).sort().reduce((acc: any, key) => {
      acc[key] = filters[key as keyof ScannerFilters];
      return acc;
    }, {});
    return `scanner:${JSON.stringify(sorted)}`;
  }

  async getTrendingWallets(limit: number = 20): Promise<WalletMetrics[]> {
    if (redis) {
      const cached = await redis.get('scanner:trending');
      if (cached) {
        return JSON.parse(cached as string);
      }
    }

    // Get wallets with highest 7-day performance
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
      ORDER BY m.performance_7d DESC
      LIMIT ${limit}
    `;

    const formatted = (results as any[]).map((m: any) => ({
      address: m.address,
      chain: m.chain,
      pnl: Number(m.pnl),
      roi: Number(m.roi),
      winRate: Number(m.winRate),
      tradeCount: Number(m.tradeCount),
      averageTrade: Number(m.averageTrade),
      volume: Number(m.volume),
      drawdown: Number(m.drawdown),
      walletScore: Number(m.walletScore),
      chains: [m.chain],
      preferredTokens: m.preferredtokens || [],
      preferredProtocols: m.preferredprotocols || [],
    }));

    if (redis) {
      await redis.set('scanner:trending', JSON.stringify(formatted), { ex: 300 });
    }

    return formatted;
  }

  async getTopPerformers(timeframe: '24h' | '7d' | '30d' | '90d' = '30d', limit: number = 20): Promise<WalletMetrics[]> {
    const cacheKey = `scanner:top:${timeframe}`;
    
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached as string);
      }
    }

    const performanceField = `performance_${timeframe === '24h' ? '24h' : timeframe === '7d' ? '7d' : timeframe === '30d' ? '30d' : '90d'}`;
    
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
      ORDER BY m.${raw(performanceField)} DESC
      LIMIT ${limit}
    `;

    const formatted = (results as any[]).map((m: any) => ({
      address: m.address,
      chain: m.chain,
      pnl: Number(m.pnl),
      roi: Number(m.roi),
      winRate: Number(m.winRate),
      tradeCount: Number(m.tradeCount),
      averageTrade: Number(m.averageTrade),
      volume: Number(m.volume),
      drawdown: Number(m.drawdown),
      walletScore: Number(m.walletScore),
      chains: [m.chain],
      preferredTokens: m.preferredtokens || [],
      preferredProtocols: m.preferredprotocols || [],
    }));

    if (redis) {
      await redis.set(cacheKey, JSON.stringify(formatted), { ex: 300 });
    }

    return formatted;
  }

  async getWhales(limit: number = 20): Promise<WalletMetrics[]> {
    if (redis) {
      const cached = await redis.get('scanner:whales');
      if (cached) {
        return JSON.parse(cached as string);
      }
    }

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
      ORDER BY m.portfolio_value DESC
      LIMIT ${limit}
    `;

    const formatted = (results as any[]).map((m: any) => ({
      address: m.address,
      chain: m.chain,
      pnl: Number(m.pnl),
      roi: Number(m.roi),
      winRate: Number(m.winRate),
      tradeCount: Number(m.tradeCount),
      averageTrade: Number(m.averageTrade),
      volume: Number(m.volume),
      drawdown: Number(m.drawdown),
      walletScore: Number(m.walletScore),
      chains: [m.chain],
      preferredTokens: m.preferredtokens || [],
      preferredProtocols: m.preferredprotocols || [],
    }));

    if (redis) {
      await redis.set('scanner:whales', JSON.stringify(formatted), { ex: 300 });
    }

    return formatted;
  }
}