// lib/services/analytics.service.ts
import { cache } from '@/lib/cache';
import { PortfolioService } from './portfolio.service';
import { PriceService } from './price.service';

export interface PerformanceMetrics {
  totalValue: number;
  dayChange: number;
  dayChangePercentage: number;
  weekChange: number;
  weekChangePercentage: number;
  monthChange: number;
  monthChangePercentage: number;
  yearChange: number;
  yearChangePercentage: number;
  bestDay: { date: string; value: number };
  worstDay: { date: string; value: number };
  averageDailyChange: number;
  volatility: number;
  sharpeRatio: number;
}

export class AnalyticsService {
  private static instance: AnalyticsService;
  private portfolioService = PortfolioService.getInstance();
  private priceService = PriceService.getInstance();

  private constructor() {}

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  async getPortfolioPerformance(
    address: string,
    chain: string,
    period: '24h' | '7d' | '30d' | '90d' | '1y'
  ): Promise<PerformanceMetrics> {
    const cacheKey = `analytics:performance:${address}:${chain}:${period}`;
    const cached = cache.get<PerformanceMetrics>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const days = this.periodToDays(period);
    const history = await this.portfolioService.getPortfolioHistory(
      address,
      chain,
      days,
      'daily'
    );

    const currentValue = history[history.length - 1]?.value || 0;
    const startValue = history[0]?.value || 0;

    // Calculate changes
    const dayChange = this.calculateChange(history, 1);
    const weekChange = this.calculateChange(history, 7);
    const monthChange = this.calculateChange(history, 30);
    const yearChange = this.calculateChange(history, 365);

    // Find best and worst days
    let bestDay = history[0];
    let worstDay = history[0];
    let totalChange = 0;
    let changes: number[] = [];

    for (let i = 1; i < history.length; i++) {
      const change = history[i].value - history[i - 1].value;
      totalChange += change;
      changes.push(change);

      if (change > (bestDay?.value || 0)) {
        bestDay = history[i];
      }
      if (change < (worstDay?.value || 0)) {
        worstDay = history[i];
      }
    }

    const averageDailyChange = changes.length > 0 
      ? totalChange / changes.length 
      : 0;

    // Calculate volatility (standard deviation)
    const volatility = this.calculateVolatility(changes);

    // Calculate Sharpe ratio (assuming risk-free rate of 2%)
    const riskFreeRate = 0.02;
    const sharpeRatio = volatility > 0
      ? ((currentValue - startValue) / startValue - riskFreeRate) / volatility
      : 0;

    const metrics: PerformanceMetrics = {
      totalValue: currentValue,
      dayChange: dayChange.change,
      dayChangePercentage: dayChange.percentage,
      weekChange: weekChange.change,
      weekChangePercentage: weekChange.percentage,
      monthChange: monthChange.change,
      monthChangePercentage: monthChange.percentage,
      yearChange: yearChange.change,
      yearChangePercentage: yearChange.percentage,
      bestDay: {
        date: bestDay?.date || new Date().toISOString(),
        value: bestDay?.value || 0,
      },
      worstDay: {
        date: worstDay?.date || new Date().toISOString(),
        value: worstDay?.value || 0,
      },
      averageDailyChange,
      volatility,
      sharpeRatio,
    };

    cache.set(cacheKey, metrics, 300);
    return metrics;
  }

  private periodToDays(period: string): number {
    switch (period) {
      case '24h': return 1;
      case '7d': return 7;
      case '30d': return 30;
      case '90d': return 90;
      case '1y': return 365;
      default: return 30;
    }
  }

  private calculateChange(
    history: any[],
    days: number
  ): { change: number; percentage: number } {
    if (history.length < days) {
      return { change: 0, percentage: 0 };
    }

    const current = history[history.length - 1];
    const previous = history[history.length - 1 - days];
    
    const change = current.value - previous.value;
    const percentage = previous.value > 0 
      ? (change / previous.value) * 100 
      : 0;

    return { change, percentage };
  }

  private calculateVolatility(changes: number[]): number {
    if (changes.length < 2) return 0;

    const mean = changes.reduce((sum, val) => sum + val, 0) / changes.length;
    const squaredDiffs = changes.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / changes.length;
    
    return Math.sqrt(variance);
  }
}