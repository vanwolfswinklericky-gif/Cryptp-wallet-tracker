// src/lib/testing/replay-test.service.ts
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { TransactionClassifier } from '@/lib/analytics/transaction-classifier';

export interface TestResult {
  txHash: string;
  expected: string;
  actual: string;
  confidence: number;
  passed: boolean;
  reason?: string;
}

export class ReplayTestService {
  private static instance: ReplayTestService;
  private classifier: TransactionClassifier;

  private constructor() {
    this.classifier = TransactionClassifier.getInstance();
  }

  static getInstance(): ReplayTestService {
    if (!ReplayTestService.instance) {
      ReplayTestService.instance = new ReplayTestService();
    }
    return ReplayTestService.instance;
  }

  /**
   * Run replay tests on historical transactions - VALIDATE EVERYTHING
   */
  async runReplayTests(limit: number = 1000): Promise<{
    total: number;
    passed: number;
    failed: number;
    accuracy: number;
    results: TestResult[];
  }> {
    logger.info('Starting replay tests...');

    // Get transactions with known outcomes
    const transactions = await prisma.transaction.findMany({
      where: {
        status: 'SUCCESS',
      },
      include: {
        tokenTransfers: true,
      },
      take: limit,
      orderBy: { timestamp: 'desc' },
    });

    const results: TestResult[] = [];
    let passed = 0;
    let failed = 0;

    for (const tx of transactions) {
      // Re-classify
      const classification = this.classifier.classify(
        tx.hash,
        tx.chain,
        tx.fromAddress,
        tx.toAddress || '',
        tx.timestamp,
        tx.blockNumber || 0,
        tx.tokenTransfers || [],
        [], // logs
        tx.status || 'SUCCESS'
      );

      // Compare with expected (stored classification)
      const expected = tx.type || 'UNKNOWN';
      const actual = classification.type;
      const passedTest = expected === actual || (expected === 'TRANSFER' && actual === 'TRANSFER');

      results.push({
        txHash: tx.hash,
        expected,
        actual,
        confidence: classification.confidence,
        passed: passedTest,
        reason: passedTest ? undefined : `Expected ${expected}, got ${actual}`,
      });

      if (passedTest) {
        passed++;
      } else {
        failed++;
      }
    }

    const accuracy = results.length > 0 ? (passed / results.length) * 100 : 0;

    logger.info(`Replay tests complete: ${passed} passed, ${failed} failed (${accuracy.toFixed(2)}%)`);

    return {
      total: results.length,
      passed,
      failed,
      accuracy,
      results,
    };
  }

  /**
   * Run tests on specific transaction types - TARGETED TESTING
   */
  async runTypeTests(type: string): Promise<{
    total: number;
    passed: number;
    accuracy: number;
    results: TestResult[];
  }> {
    const transactions = await prisma.transaction.findMany({
      where: {
        type,
        status: 'SUCCESS',
      },
      include: {
        tokenTransfers: true,
      },
      take: 500,
    });

    const results: TestResult[] = [];
    let passed = 0;

    for (const tx of transactions) {
      const classification = this.classifier.classify(
        tx.hash,
        tx.chain,
        tx.fromAddress,
        tx.toAddress || '',
        tx.timestamp,
        tx.blockNumber || 0,
        tx.tokenTransfers || [],
        [],
        tx.status || 'SUCCESS'
      );

      const passedTest = classification.type === type;
      results.push({
        txHash: tx.hash,
        expected: type,
        actual: classification.type,
        confidence: classification.confidence,
        passed: passedTest,
        reason: passedTest ? undefined : `Expected ${type}, got ${classification.type}`,
      });

      if (passedTest) passed++;
    }

    return {
      total: results.length,
      passed,
      accuracy: results.length > 0 ? (passed / results.length) * 100 : 0,
      results,
    };
  }

  /**
   * Generate accuracy report - MEASURABLE ENGINEERING TARGETS
   */
  async generateReport(): Promise<{
    overall: number;
    byType: Record<string, number>;
    totalTested: number;
    timestamp: Date;
  }> {
    const report = await this.runReplayTests(5000);
    
    const byType: Record<string, { passed: number; total: number }> = {};
    for (const result of report.results) {
      if (!byType[result.expected]) {
        byType[result.expected] = { passed: 0, total: 0 };
      }
      byType[result.expected].total++;
      if (result.passed) byType[result.expected].passed++;
    }

    const byTypeAccuracy: Record<string, number> = {};
    for (const [type, data] of Object.entries(byType)) {
      byTypeAccuracy[type] = (data.passed / data.total) * 100;
    }

    return {
      overall: report.accuracy,
      byType: byTypeAccuracy,
      totalTested: report.total,
      timestamp: new Date(),
    };
  }
}