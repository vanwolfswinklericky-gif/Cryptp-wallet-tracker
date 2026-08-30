// src/lib/services/raw-evidence.service.ts
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

export interface RawEvidence {
  id: string;
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
  status: 'PENDING' | 'PROCESSED' | 'FAILED' | 'REVIEW';
  error?: string;
  retryCount: number;
  ingestedAt: Date;
  processedAt?: Date;
}

export class RawEvidenceService {
  private static instance: RawEvidenceService;

  static getInstance(): RawEvidenceService {
    if (!RawEvidenceService.instance) {
      RawEvidenceService.instance = new RawEvidenceService();
    }
    return RawEvidenceService.instance;
  }

  /**
   * Store raw blockchain evidence - NEVER overwritten
   */
  async storeEvidence(data: Omit<RawEvidence, 'id' | 'ingestedAt' | 'retryCount' | 'status'>): Promise<RawEvidence> {
    const evidence = await prisma.rawTransaction.create({
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
        retryCount: 0,
      },
    });

    logger.info(`Raw evidence stored: ${data.txHash}`);
    return evidence;
  }

  /**
   * Get raw evidence by transaction hash - ALWAYS traceable
   */
  async getEvidence(txHash: string): Promise<RawEvidence | null> {
    return prisma.rawTransaction.findUnique({
      where: { txHash },
    });
  }

  /**
   * Get evidence by wallet - FULL TRACEABILITY
   */
  async getEvidenceByWallet(walletAddress: string, chain: string, limit: number = 100): Promise<RawEvidence[]> {
    return prisma.rawTransaction.findMany({
      where: {
        chain,
        OR: [
          { fromAddress: walletAddress },
          { toAddress: walletAddress },
        ],
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  /**
   * Update evidence status
   */
  async updateStatus(
    txHash: string,
    status: 'PROCESSED' | 'FAILED' | 'REVIEW',
    error?: string
  ): Promise<void> {
    await prisma.rawTransaction.update({
      where: { txHash },
      data: {
        status,
        error,
        processedAt: status === 'PROCESSED' ? new Date() : undefined,
        ...(status === 'FAILED' ? { retryCount: { increment: 1 } } : {}),
      },
    });
  }

  /**
   * Get evidence that needs reprocessing - DESIGNED FOR REPROCESSING
   */
  async getEvidenceForReprocessing(limit: number = 100): Promise<RawEvidence[]> {
    return prisma.rawTransaction.findMany({
      where: {
        OR: [
          { status: 'FAILED', retryCount: { lt: 3 } },
          { status: 'PENDING' },
        ],
      },
      orderBy: { ingestedAt: 'asc' },
      take: limit,
    });
  }
}