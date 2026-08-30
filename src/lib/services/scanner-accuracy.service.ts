// src/lib/services/scanner-accuracy.service.ts
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

export interface ScannerAccuracyResult {
  walletId: string;
  address: string;
  chain: string;
  predictedScore: number;
  actualScore: number;
  accuracy: number;
  deviation: number;
  factors: {
    pnlAccuracy: number;
    roiAccuracy: number;
    winRateAccuracy: number;
    drawdownAccuracy: number;
  };
}

export class ScannerAccuracyService {
  private static instance: ScannerAccuracyService;

  static getInstance(): ScannerAccuracyService {
    if (!ScannerAccuracyService.instance) {
      ScannerAccuracyService.instance = new ScannerAccuracyService();
    }
    return ScannerAccuracyService.instance;
  }

  /**
   * Validate scanner accuracy - MEASURE AND IMPROVE
   */
  async validateScannerResults(walletId: string): Promise<ScannerAccuracyResult | null> {
    try {
      // Get predicted metrics (from scanner)
      const scanned = await prisma.scannedWallet.findFirst({
        where: { walletId },
        orderBy: { timestamp: 'desc' },
      });

      if (!scanned) return null;

      // Get actual metrics (from database)
      const metric = await prisma.walletMetric.findFirst({
        where: { walletId },
        orderBy: { timestamp: 'desc' },
      });

      if (!metric) return null;

      // Calculate accuracy
      const pnlAccuracy = this.calculateAccuracy(metric.totalPnl, scanned.score);
      const roiAccuracy = this.calculateAccuracy(metric.totalRoi, scanned.score);
      const winRateAccuracy = this.calculateAccuracy(metric.winRate, scanned.score);
      const drawdownAccuracy = this.calculateAccuracy(metric.maxDrawdown, scanned.score);

      const overallAccuracy = (pnlAccuracy + roiAccuracy + winRateAccuracy + drawdownAccuracy) / 4;

      return {
        walletId,
        address: '', // Would need to fetch address
        chain: '', // Would need to fetch chain
        predictedScore: scanned.score,
        actualScore: metric.walletScore || 0,
        accuracy: overallAccuracy,
        deviation: scanned.score - (metric.walletScore || 0),
        factors: {
          pnlAccuracy,
          roiAccuracy,
          winRateAccuracy,
          drawdownAccuracy,
        },
      };
    } catch (error) {
      logger.error('Scanner accuracy validation failed:', error);
      return null;
    }
  }

  private calculateAccuracy(predicted: number, actual: number): number {
    if (actual === 0) return predicted === 0 ? 100 : 0;
    const difference = Math.abs(predicted - actual) / actual;
    return Math.max(0, 100 - (difference * 100));
  }

  /**
   * Batch validate scanner - SCALABLE ACCURACY TRACKING
   */
  async batchValidate(limit: number = 100): Promise<{
    total: number;
    averageAccuracy: number;
    results: ScannerAccuracyResult[];
  }> {
    const scannedWallets = await prisma.scannedWallet.findMany({
      take: limit,
      orderBy: { timestamp: 'desc' },
      include: {
        wallet: {
          include: {
            metrics: {
              orderBy: { timestamp: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    const results: ScannerAccuracyResult[] = [];
    let totalAccuracy = 0;

    for (const scanned of scannedWallets) {
      const result = await this.validateScannerResults(scanned.walletId);
      if (result) {
        results.push(result);
        totalAccuracy += result.accuracy;
      }
    }

    return {
      total: results.length,
      averageAccuracy: results.length > 0 ? totalAccuracy / results.length : 0,
      results,
    };
  }

  /**
   * Track scanner performance over time - TREND ANALYSIS
   */
  async trackPerformance(days: number = 30): Promise<{
    daily: Array<{ date: string; accuracy: number; count: number }>;
    average: number;
  }> {
    const results: Array<{ date: string; accuracy: number }> = [];

    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // Get scans from this day
      const scans = await prisma.scannedWallet.findMany({
        where: {
          timestamp: {
            gte: new Date(date.setHours(0, 0, 0, 0)),
            lt: new Date(date.setHours(23, 59, 59, 999)),
          },
        },
        include: {
          wallet: {
            include: {
              metrics: {
                orderBy: { timestamp: 'desc' },
                take: 1,
              },
            },
          },
        },
      });

      if (scans.length > 0) {
        let dayAccuracy = 0;
        for (const scan of scans) {
          const metric = scan.wallet.metrics[0];
          if (metric) {
            dayAccuracy += this.calculateAccuracy(scan.score, metric.walletScore || 0);
          }
        }
        results.push({
          date: dateStr,
          accuracy: dayAccuracy / scans.length,
        });
      }
    }

    const average = results.length > 0 
      ? results.reduce((sum, r) => sum + r.accuracy, 0) / results.length 
      : 0;

    return {
      daily: results,
      average,
    };
  }
}