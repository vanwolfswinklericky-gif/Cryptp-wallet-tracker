// src/lib/normalization/transaction-normalizer.ts
import { logger } from '@/lib/logger';

export interface NormalizedTransaction {
  txHash: string;
  chain: string;
  blockNumber: number;
  blockHash: string;
  timestamp: Date;
  fromAddress: string;
  toAddress: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  status: 'success' | 'failed' | 'pending';
  inputData: string;
  methodId: string;
  logs: NormalizedLog[];
  tokenTransfers: NormalizedTokenTransfer[];
}

export interface NormalizedLog {
  address: string;
  topics: string[];
  data: string;
  logIndex: number;
  transactionIndex: number;
}

export interface NormalizedTokenTransfer {
  tokenAddress: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  decimal: number;
  logIndex: number;
}

export class TransactionNormalizer {
  private static instance: TransactionNormalizer;

  static getInstance(): TransactionNormalizer {
    if (!TransactionNormalizer.instance) {
      TransactionNormalizer.instance = new TransactionNormalizer();
    }
    return TransactionNormalizer.instance;
  }

  /**
   * Normalize Alchemy transaction format
   */
  normalizeAlchemy(tx: any, chain: string): NormalizedTransaction {
    try {
      return {
        txHash: tx.hash || tx.transactionHash,
        chain: chain.toUpperCase(),
        blockNumber: parseInt(tx.blockNumber || tx.blockNum, 16),
        blockHash: tx.blockHash || tx.blockHash,
        timestamp: new Date(parseInt(tx.timestamp || tx.timeStamp, 10) * 1000),
        fromAddress: tx.from || tx.fromAddress,
        toAddress: tx.to || tx.toAddress || '',
        value: tx.value || '0',
        gasUsed: tx.gasUsed || tx.gas || '0',
        gasPrice: tx.gasPrice || tx.gasPrice || '0',
        status: this.determineStatus(tx.status, tx.receiptStatus),
        inputData: tx.input || tx.inputData || '',
        methodId: tx.methodId || '',
        logs: this.normalizeLogs(tx.logs || []),
        tokenTransfers: this.normalizeTokenTransfers(tx.tokenTransfers || []),
      };
    } catch (error) {
      logger.error('Failed to normalize Alchemy transaction:', error);
      throw error;
    }
  }

  /**
   * Normalize Moralis transaction format
   */
  normalizeMoralis(tx: any, chain: string): NormalizedTransaction {
    try {
      return {
        txHash: tx.hash || tx.transactionHash,
        chain: chain.toUpperCase(),
        blockNumber: tx.blockNumber || 0,
        blockHash: tx.blockHash || '',
        timestamp: new Date(tx.blockTimestamp || tx.timestamp),
        fromAddress: tx.fromAddress || tx.from,
        toAddress: tx.toAddress || tx.to || '',
        value: tx.value || '0',
        gasUsed: tx.gas || tx.gasUsed || '0',
        gasPrice: tx.gasPrice || tx.gasPrice || '0',
        status: this.determineStatus(tx.receiptStatus, tx.status),
        inputData: tx.input || tx.inputData || '',
        methodId: tx.methodId || '',
        logs: this.normalizeLogs(tx.logs || []),
        tokenTransfers: this.normalizeTokenTransfers(tx.tokenTransfers || []),
      };
    } catch (error) {
      logger.error('Failed to normalize Moralis transaction:', error);
      throw error;
    }
  }

  /**
   * Normalize Infura transaction format
   */
  normalizeInfura(tx: any, chain: string): NormalizedTransaction {
    try {
      return {
        txHash: tx.hash || tx.transactionHash,
        chain: chain.toUpperCase(),
        blockNumber: tx.blockNumber || 0,
        blockHash: tx.blockHash || '',
        timestamp: new Date(parseInt(tx.timestamp || tx.timeStamp, 10) * 1000),
        fromAddress: tx.from || tx.fromAddress,
        toAddress: tx.to || tx.toAddress || '',
        value: tx.value || '0',
        gasUsed: tx.gasUsed || tx.gas || '0',
        gasPrice: tx.gasPrice || tx.gasPrice || '0',
        status: this.determineStatus(tx.status, tx.receiptStatus),
        inputData: tx.input || tx.inputData || '',
        methodId: tx.methodId || '',
        logs: this.normalizeLogs(tx.logs || []),
        tokenTransfers: this.normalizeTokenTransfers(tx.tokenTransfers || []),
      };
    } catch (error) {
      logger.error('Failed to normalize Infura transaction:', error);
      throw error;
    }
  }

  private determineStatus(status: any, receiptStatus: any): 'success' | 'failed' | 'pending' {
    if (status === 'pending' || status === 'PENDING') return 'pending';
    if (status === 'success' || status === 'SUCCESS' || receiptStatus === '1' || receiptStatus === '0x1') {
      return 'success';
    }
    if (status === 'failed' || status === 'FAILED' || receiptStatus === '0' || receiptStatus === '0x0') {
      return 'failed';
    }
    return 'pending';
  }

  private normalizeLogs(logs: any[]): NormalizedLog[] {
    return logs.map(log => ({
      address: log.address || log.logAddress || '',
      topics: log.topics || [],
      data: log.data || '',
      logIndex: log.logIndex || log.logIndex || 0,
      transactionIndex: log.transactionIndex || 0,
    }));
  }

  private normalizeTokenTransfers(transfers: any[]): NormalizedTokenTransfer[] {
    return transfers.map(transfer => ({
      tokenAddress: transfer.tokenAddress || transfer.contractAddress || '',
      fromAddress: transfer.from || transfer.fromAddress || '',
      toAddress: transfer.to || transfer.toAddress || '',
      amount: transfer.amount || transfer.value || '0',
      decimal: transfer.decimal || transfer.decimals || 18,
      logIndex: transfer.logIndex || 0,
    }));
  }

  /**
   * Auto-detect and normalize from any provider
   */
  normalize(provider: string, tx: any, chain: string): NormalizedTransaction {
    switch (provider.toLowerCase()) {
      case 'alchemy':
        return this.normalizeAlchemy(tx, chain);
      case 'moralis':
        return this.normalizeMoralis(tx, chain);
      case 'infura':
        return this.normalizeInfura(tx, chain);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }
}