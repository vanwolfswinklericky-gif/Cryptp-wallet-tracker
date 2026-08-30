// src/lib/signals/signal-versioning.ts
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

export interface SignalVersion {
  id: string;
  signalId: string;
  version: number;
  data: any;
  changes: any;
  reason: string;
  createdAt: Date;
}

export class SignalVersioning {
  private static instance: SignalVersioning;

  static getInstance(): SignalVersioning {
    if (!SignalVersioning.instance) {
      SignalVersioning.instance = new SignalVersioning();
    }
    return SignalVersioning.instance;
  }

  /**
   * Create new version of a signal - TRACEABLE IMPROVEMENTS
   */
  async createVersion(
    signalId: string,
    newData: any,
    changes: any,
    reason: string
  ): Promise<SignalVersion> {
    // Get current version
    const current = await this.getLatestVersion(signalId);
    const newVersion = (current?.version || 0) + 1;

    const version: SignalVersion = {
      id: `sv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      signalId,
      version: newVersion,
      data: newData,
      changes,
      reason,
      createdAt: new Date(),
    };

    // Store version
    await prisma.auditLog.create({
      data: {
        userId: null,
        action: 'SIGNAL_VERSION',
        entityType: 'SignalVersion',
        entityId: version.id,
        changes: {
          signalId,
          version: newVersion,
          changes,
          reason,
        },
        metadata: {
          data: newData,
          timestamp: new Date().toISOString(),
        },
      },
    });

    logger.info(`Signal ${signalId} version ${newVersion} created: ${reason}`);
    return version;
  }

  /**
   * Get latest version - REPRODUCIBLE
   */
  async getLatestVersion(signalId: string): Promise<SignalVersion | null> {
    const logs = await prisma.auditLog.findMany({
      where: {
        action: 'SIGNAL_VERSION',
        entityId: signalId,
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    if (logs.length === 0) return null;

    const log = logs[0];
    return {
      id: log.entityId,
      signalId: log.changes.signalId,
      version: log.changes.version,
      data: log.metadata.data,
      changes: log.changes.changes,
      reason: log.changes.reason,
      createdAt: log.createdAt,
    };
  }

  /**
   * Get all versions - FULL HISTORY
   */
  async getAllVersions(signalId: string): Promise<SignalVersion[]> {
    const logs = await prisma.auditLog.findMany({
      where: {
        action: 'SIGNAL_VERSION',
        entityId: signalId,
      },
      orderBy: { createdAt: 'asc' },
    });

    return logs.map(log => ({
      id: log.entityId,
      signalId: log.changes.signalId,
      version: log.changes.version,
      data: log.metadata.data,
      changes: log.changes.changes,
      reason: log.changes.reason,
      createdAt: log.createdAt,
    }));
  }

  /**
   * Rollback to specific version - FLEXIBLE
   */
  async rollbackToVersion(signalId: string, version: number): Promise<SignalVersion | null> {
    const versions = await this.getAllVersions(signalId);
    const target = versions.find(v => v.version === version);
    
    if (!target) {
      logger.warn(`Version ${version} not found for signal ${signalId}`);
      return null;
    }

    return this.createVersion(
      signalId,
      target.data,
      { rollbackFrom: 'latest', rollbackTo: version },
      `Rolled back to version ${version}`
    );
  }
}