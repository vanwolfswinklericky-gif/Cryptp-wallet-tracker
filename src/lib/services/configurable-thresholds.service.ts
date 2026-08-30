// src/lib/services/configurable-thresholds.service.ts
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

export interface UserThresholds {
  userId: string;
  minConfidence: number;
  minValueUsd: number;
  maxDrawdown: number;
  minWinRate: number;
  minTrades: number;
  preferredTokens: string[];
  excludedTokens: string[];
  preferredChains: string[];
  alertCooldown: number;
  maxAlertsPerDay: number;
}

export class ConfigurableThresholdsService {
  private static instance: ConfigurableThresholdsService;

  static getInstance(): ConfigurableThresholdsService {
    if (!ConfigurableThresholdsService.instance) {
      ConfigurableThresholdsService.instance = new ConfigurableThresholdsService();
    }
    return ConfigurableThresholdsService.instance;
  }

  /**
   * Get user thresholds - CUSTOMIZED EXPERIENCE
   */
  async getUserThresholds(userId: string): Promise<UserThresholds> {
    const preferences = await prisma.userPreference.findUnique({
      where: { userId },
    });

    if (!preferences) {
      // Return defaults
      return {
        userId,
        minConfidence: 80,
        minValueUsd: 1000,
        maxDrawdown: 30,
        minWinRate: 55,
        minTrades: 20,
        preferredTokens: [],
        excludedTokens: [],
        preferredChains: ['ETHEREUM', 'BASE', 'POLYGON'],
        alertCooldown: 60,
        maxAlertsPerDay: 50,
      };
    }

    return {
      userId,
      minConfidence: (preferences as any).minConfidence || 80,
      minValueUsd: (preferences as any).minValueUsd || 1000,
      maxDrawdown: (preferences as any).maxDrawdown || 30,
      minWinRate: (preferences as any).minWinRate || 55,
      minTrades: (preferences as any).minTrades || 20,
      preferredTokens: (preferences as any).preferredTokens || [],
      excludedTokens: (preferences as any).excludedTokens || [],
      preferredChains: (preferences as any).preferredChains || ['ETHEREUM', 'BASE', 'POLYGON'],
      alertCooldown: (preferences as any).alertCooldown || 60,
      maxAlertsPerDay: (preferences as any).maxAlertsPerDay || 50,
    };
  }

  /**
   * Update user thresholds - USER CONTROL
   */
  async updateThresholds(
    userId: string,
    updates: Partial<UserThresholds>
  ): Promise<UserThresholds> {
    const current = await this.getUserThresholds(userId);
    const updated = { ...current, ...updates };

    // Store in database
    await prisma.userPreference.upsert({
      where: { userId },
      update: updated,
      create: {
        userId,
        ...updated,
      },
    });

    logger.info(`Thresholds updated for user ${userId}`);
    return updated;
  }

  /**
   * Apply thresholds to signal - FILTERING
   */
  async shouldSendSignal(
    userId: string,
    signal: any
  ): Promise<{ shouldSend: boolean; reason?: string }> {
    const thresholds = await this.getUserThresholds(userId);

    // Check confidence
    if (signal.confidence < thresholds.minConfidence) {
      return { shouldSend: false, reason: `Confidence ${signal.confidence}% below threshold ${thresholds.minConfidence}%` };
    }

    // Check value
    if (signal.valueUsd < thresholds.minValueUsd) {
      return { shouldSend: false, reason: `Value $${signal.valueUsd} below threshold $${thresholds.minValueUsd}` };
    }

    // Check excluded tokens
    if (signal.token && thresholds.excludedTokens.includes(signal.token)) {
      return { shouldSend: false, reason: `Token ${signal.token} is excluded` };
    }

    // Check preferred tokens
    if (thresholds.preferredTokens.length > 0 && signal.token) {
      if (!thresholds.preferredTokens.includes(signal.token)) {
        return { shouldSend: false, reason: `Token ${signal.token} not in preferred list` };
      }
    }

    // Check chain
    if (signal.chain && thresholds.preferredChains.length > 0) {
      if (!thresholds.preferredChains.includes(signal.chain)) {
        return { shouldSend: false, reason: `Chain ${signal.chain} not in preferred chains` };
      }
    }

    return { shouldSend: true };
  }
}