// src/lib/services/export.service.ts
import { prisma } from '@/lib/db/prisma';
import { AuditService } from './audit.service';
import { logger } from '@/lib/logger';
import { ValidationError } from '@/lib/errors';
import { z } from 'zod';

const ExportSchema = z.object({
  format: z.enum(['csv', 'json']),
  type: z.enum(['holdings', 'transactions', 'complete']),
  walletId: z.string().optional(),
});

export class ExportService {
  private static instance: ExportService;

  private constructor() {}

  static getInstance(): ExportService {
    if (!ExportService.instance) {
      ExportService.instance = new ExportService();
    }
    return ExportService.instance;
  }

  /**
   * ✅ Generate CSV for holdings
   */
  async exportHoldings(userId: string, walletId?: string) {
    const where: any = { userId, isDeleted: false };
    if (walletId) {
      where.id = walletId;
    }

    const wallets = await prisma.wallet.findMany({
      where,
      include: {
        metrics: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
        transactions: {
          take: 1000,
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    const rows: any[] = [];

    for (const wallet of wallets) {
      const metric = wallet.metrics[0];
      const tokenBalances = await this.getTokenBalances(wallet.id);

      rows.push({
        'Wallet Address': wallet.address,
        'Chain': wallet.chain,
        'Label': wallet.label || 'Unnamed',
        'Total PnL': metric?.totalPnl || 0,
        'ROI %': metric?.totalRoi || 0,
        'Win Rate %': metric?.winRate || 0,
        'Trade Count': metric?.tradeCount || 0,
        'Total Volume': metric?.totalVolume || 0,
        'Wallet Score': metric?.walletScore || 0,
        'Tokens Count': tokenBalances.length,
        'Last Updated': new Date().toISOString(),
      });
    }

    return rows;
  }

  /**
   * ✅ Export to CSV format
   */
  async exportToCSV(userId: string, options: {
    type: 'holdings' | 'transactions' | 'complete';
    walletId?: string;
  }) {
    const data = await this.exportHoldings(userId, options.walletId);

    if (data.length === 0) {
      throw new ValidationError('No data to export');
    }

    // Audit log
    await AuditService.log({
      userId,
      action: 'EXPORT',
      entityType: 'Export',
      entityId: `csv_${options.type}`,
      metadata: { type: options.type, walletId: options.walletId, recordCount: data.length },
    });

    logger.info('Export generated', { userId, type: options.type, count: data.length });

    return {
      headers: Object.keys(data[0]),
      rows: data,
      total: data.length,
    };
  }

  /**
   * ✅ Get token balances
   */
  private async getTokenBalances(walletId: string) {
    // This would fetch from your token service
    return [];
  }
}

export const exportService = ExportService.getInstance();