// src/lib/services/price-validation.service.ts
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

export interface PriceValidationResult {
  price: number;
  source: string;
  confidence: number;
  sources: { source: string; price: number }[];
  timestamp: Date;
}

export class PriceValidationService {
  private static instance: PriceValidationService;

  static getInstance(): PriceValidationService {
    if (!PriceValidationService.instance) {
      PriceValidationService.instance = new PriceValidationService();
    }
    return PriceValidationService.instance;
  }

  async validatePrice(
    tokenAddress: string,
    chain: string,
    timestamp: Date,
    sources: string[] = ['alchemy', 'moralis', 'defillama']
  ): Promise<PriceValidationResult | null> {
    try {
      const prices: { source: string; price: number }[] = [];
      
      for (const source of sources) {
        const price = await this.fetchPriceFromSource(tokenAddress, chain, timestamp, source);
        if (price) {
          prices.push({ source, price });
        }
      }

      if (prices.length === 0) {
        logger.warn(`No price found for ${tokenAddress} on ${chain}`);
        return null;
      }

      // Calculate median price
      const sortedPrices = prices.map(p => p.price).sort((a, b) => a - b);
      const medianPrice = sortedPrices[Math.floor(sortedPrices.length / 2)];
      
      // Calculate variance
      const variance = this.calculateVariance(prices.map(p => p.price), medianPrice);
      
      // Determine confidence
      const confidence = this.calculateConfidence(variance, prices.length);
      
      return {
        price: medianPrice,
        source: prices[0].source,
        confidence,
        sources: prices,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Price validation error:', error);
      return null;
    }
  }

  private async fetchPriceFromSource(
    tokenAddress: string,
    chain: string,
    timestamp: Date,
    source: string
  ): Promise<number | null> {
    try {
      // Implement actual price fetching from each provider
      // This is a simplified version
      switch (source) {
        case 'alchemy':
          return await this.getAlchemyPrice(tokenAddress, chain, timestamp);
        case 'moralis':
          return await this.getMoralisPrice(tokenAddress, chain, timestamp);
        case 'defillama':
          return await this.getDefiLlamaPrice(tokenAddress, chain, timestamp);
        default:
          return null;
      }
    } catch (error) {
      logger.error(`Failed to fetch price from ${source}:`, error);
      return null;
    }
  }

  private async getAlchemyPrice(tokenAddress: string, chain: string, timestamp: Date): Promise<number | null> {
    // Implement Alchemy price fetching
    return 3500; // Mock
  }

  private async getMoralisPrice(tokenAddress: string, chain: string, timestamp: Date): Promise<number | null> {
    // Implement Moralis price fetching
    return 3498; // Mock
  }

  private async getDefiLlamaPrice(tokenAddress: string, chain: string, timestamp: Date): Promise<number | null> {
    // Implement DefiLlama price fetching
    return 3502; // Mock
  }

  private calculateVariance(prices: number[], median: number): number {
    if (prices.length === 0) return 0;
    const sum = prices.reduce((acc, p) => acc + Math.abs(p - median), 0);
    return sum / prices.length / median;
  }

  private calculateConfidence(variance: number, sourceCount: number): number {
    // Base confidence starts at 50
    let confidence = 50;
    
    // Higher variance = lower confidence
    if (variance < 0.01) confidence += 30;
    else if (variance < 0.02) confidence += 20;
    else if (variance < 0.05) confidence += 10;
    else if (variance > 0.10) confidence -= 20;
    
    // More sources = higher confidence
    if (sourceCount >= 3) confidence += 20;
    else if (sourceCount >= 2) confidence += 10;
    
    return Math.min(Math.max(confidence, 0), 100);
  }
}