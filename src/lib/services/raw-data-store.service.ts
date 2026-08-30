// src/lib/services/raw-data-store.service.ts
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

export class RawDataStore {
  private static instance: RawDataStore;

  static getInstance(): RawDataStore {
    if (!RawDataStore.instance) {
      RawDataStore.instance = new RawDataStore();
    }
    return RawDataStore.instance;
  }

  async storeRawTransaction(data: {
    chain: string;
    txHash: string;
    blockNumber: number;
    blockHash: string;
    timestamp: Date;
    fromAddress: string;
    toAddress: string;
    rawData: any;
    provider: string;
    providerId: string;
  }) {
    return prisma.rawTransaction.create({
      data: {
        chain: data.chain,
        txHash: data.txHash,
        blockNumber: data.blockNumber,
        blockHash: data.blockHash,
        timestamp: data.timestamp,
        fromAddress: data.fromAddress,
        toAddress: data.toAddress,
        rawData: data.rawData,
        provider: data.provider,
        providerId: data.providerId,
        status: 'PENDING',
      },
    });
  }

  async getRawTransaction(txHash: string): Promise<any> {
    return prisma.rawTransaction.findUnique({
      where: { txHash },
    });
  }

  async updateRawTransactionStatus(
    txHash: string,
    status: 'PROCESSED' | 'FAILED',
    error?: string
  ) {
    return prisma.rawTransaction.update({
      where: { txHash },
      data: {
        status,
        error,
        processedAt: new Date(),
        ...(status === 'PROCESSED' ? { retryCount: { increment: 0 } } : { retryCount: { increment: 1 } }),
      },
    });
  }

  async getUnprocessedTransactions(limit: number = 100): Promise<any[]> {
    return prisma.rawTransaction.findMany({
      where: {
        status: 'PENDING',
        retryCount: { lt: 3 },
      },
      orderBy: { ingestedAt: 'asc' },
      take: limit,
    });
  }
}