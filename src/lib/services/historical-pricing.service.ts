// src/lib/services/historical-pricing.service.ts
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

export interface HistoricalPrice {
  tokenAddress: string;
  chain: string;
  priceUsd: number;
  timestamp: Date;
  blockNumber?: number;
  source: string;
  confidence: number;
}

export class HistoricalPricingService {
  private static instance: HistoricalPricingService;

  static getInstance(): HistoricalPricingService {
    if (!HistoricalPricingService.instance) {
      HistoricalPricingService.instance = new HistoricalPricingService();
    }
    return HistoricalPricingService.instance;
  }

  /**
   * Store price at exact transaction time - NEVER use today's price
   */
  async storePrice(
    tokenAddress: string,
    chain: string,
    priceUsd: number,
    timestamp: Date,
    source: string,
    blockNumber?: number,
    confidence: number = 80
  ): Promise<void> {
    // Get or create token
    let token = await prisma.token.findUnique({
      where: { chain_address: { chain, address: tokenAddress } },
    });

    if (!token) {
      token = await prisma.token.create({
        data: {
          chain,
          address: tokenAddress,
          symbol: 'Unknown',
          name: 'Unknown Token',
          decimals: 18,
        },
      });
    }

    await prisma.tokenPrice.create({
      data: {
        tokenId: token.id,
        chain,
        priceUsd,
        priceChange24h: 0,
        timestamp,
        volume24h: 0,
      },
    });

    logger.info(`Price stored: ${tokenAddress} @ ${priceUsd} at ${timestamp.toISOString()}`);
  }

  /**
   * Get price at exact transaction time - REPRODUCIBLE
   */
  async getPriceAtTime(
    tokenAddress: string,
    chain: string,
    targetTimestamp: Date,
    toleranceMs: number = 60000 // 1 minute
  ): Promise<HistoricalPrice | null> {
    const prices = await prisma.tokenPrice.findMany({
      where: {
        token: { chain, address: tokenAddress },
        timestamp: {
          gte: new Date(targetTimestamp.getTime() - toleranceMs),
          lte: new Date(targetTimestamp.getTime() + toleranceMs),
        },
      },
      orderBy: { timestamp: 'asc' },
      take: 1,
    });

    if (prices.length === 0) {
      // If no exact match, get closest
      const closest = await prisma.tokenPrice.findFirst({
        where: {
          token: { chain, address: tokenAddress },
          timestamp: {
            lte: targetTimestamp,
          },
        },
        orderBy: { timestamp: 'desc' },
      });

      if (closest) {
        return {
          tokenAddress,
          chain,
          priceUsd: closest.priceUsd,
          timestamp: closest.timestamp,
          source: 'database',
          confidence: 70,
        };
      }

      return null;
    }

    return {
      tokenAddress,
      chain,
      priceUsd: prices[0].priceUsd,
      timestamp: prices[0].timestamp,
      source: 'database',
      confidence: 85,
    };
  }

  /**
   * Get average price from multiple sources - INCREASES CONFIDENCE
   */
  async getVerifiedPrice(
    tokenAddress: string,
    chain: string,
    timestamp: Date,
    sources: string[] = ['alchemy', 'moralis']
  ): Promise<HistoricalPrice | null> {
    const prices: { source: string; price: number }[] = [];

    for (const source of sources) {
      const price = await this.fetchPriceFromSource(tokenAddress, chain, timestamp, source);
      if (price) {
        prices.push({ source, price });
      }
    }

    if (prices.length === 0) {
      logger.warn(`No price found for ${tokenAddress} at ${timestamp.toISOString()}`);
      return null;
    }

    // Calculate median
    const sorted = prices.map(p => p.price).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    
    // Calculate confidence based on variance
    const variance = this.calculateVariance(prices.map(p => p.price), median);
    const confidence = this.calculateConfidence(variance, prices.length);

    return {
      tokenAddress,
      chain,
      priceUsd: median,
      timestamp,
      source: 'multi-provider',
      confidence,
    };
  }

  private async fetchPriceFromSource(
    tokenAddress: string,
    chain: string,
    timestamp: Date,
    source: string
  ): Promise<number | null> {
    try {
      // Implement provider-specific price fetching
      // This is a placeholder - implement actual API calls
      return 3500; // Mock price
    } catch (error) {
      logger.error(`Failed to fetch price from ${source}:`, error);
      return null;
    }
  }

  private calculateVariance(prices: number[], median: number): number {
    if (prices.length === 0) return 0;
    const sum = prices.reduce((acc, p) => acc + Math.abs(p - median), 0);
    return sum / prices.length / median;
  }

  private calculateConfidence(variance: number, sourceCount: number): number {
    let confidence = 50;
    if (variance < 0.01) confidence += 30;
    else if (variance < 0.02) confidence += 20;
    else if (variance < 0.05) confidence += 10;
    else if (variance > 0.10) confidence -= 20;
    
    if (sourceCount >= 3) confidence += 20;
    else if (sourceCount >= 2) confidence += 10;
    
    return Math.min(Math.max(confidence, 0), 100);
  }
}