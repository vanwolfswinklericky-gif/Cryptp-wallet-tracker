// src/lib/providers/provider-health.service.ts
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';

export interface ProviderHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  successRate: number;
  lastCheck: Date;
  errors: number;
  totalRequests: number;
}

export class ProviderHealthService {
  private static instance: ProviderHealthService;
  private healthData: Map<string, ProviderHealth> = new Map();

  static getInstance(): ProviderHealthService {
    if (!ProviderHealthService.instance) {
      ProviderHealthService.instance = new ProviderHealthService();
    }
    return ProviderHealthService.instance;
  }

  /**
   * Check provider health - PROACTIVE MONITORING
   */
  async checkHealth(provider: string): Promise<ProviderHealth> {
    const start = Date.now();
    let success = false;
    let error = null;

    try {
      // Perform health check
      await this.pingProvider(provider);
      success = true;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    const latency = Date.now() - start;
    const health = this.updateHealthMetrics(provider, success, latency, error);

    // Store in Redis for persistence
    await redis.set(
      `provider:health:${provider}`,
      JSON.stringify(health),
      60 // 1 minute TTL
    );

    return health;
  }

  /**
   * Get provider health - ROUTING DECISIONS
   */
  async getHealth(provider: string): Promise<ProviderHealth> {
    // Check cache first
    const cached = await redis.get(`provider:health:${provider}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // If not cached, check now
    return this.checkHealth(provider);
  }

  /**
   * Get all provider health - DASHBOARD
   */
  async getAllHealth(): Promise<Record<string, ProviderHealth>> {
    const providers = ['alchemy', 'moralis', 'infura'];
    const results: Record<string, ProviderHealth> = {};

    for (const provider of providers) {
      results[provider] = await this.getHealth(provider);
    }

    return results;
  }

  /**
   * Get best provider - INTELLIGENT ROUTING
   */
  async getBestProvider(
    chain: string,
    dataType: string
  ): Promise<string> {
    const health = await this.getAllHealth();
    const providers = Object.entries(health);

    // Filter by status
    const healthy = providers.filter(([_, h]) => h.status === 'healthy');
    
    if (healthy.length === 0) {
      logger.warn('No healthy providers available, using degraded');
      const degraded = providers.filter(([_, h]) => h.status === 'degraded');
      if (degraded.length === 0) {
        return 'alchemy'; // Fallback
      }
      return degraded[0][0];
    }

    // Sort by latency
    healthy.sort((a, b) => a[1].latency - b[1].latency);
    return healthy[0][0];
  }

  private updateHealthMetrics(
    provider: string,
    success: boolean,
    latency: number,
    error: string | null
  ): ProviderHealth {
    const current = this.healthData.get(provider) || {
      name: provider,
      status: 'healthy',
      latency: 0,
      successRate: 100,
      lastCheck: new Date(),
      errors: 0,
      totalRequests: 0,
    };

    // Update metrics
    current.totalRequests++;
    if (!success) {
      current.errors++;
    }

    // Calculate success rate (last 100 requests)
    current.successRate = ((current.totalRequests - current.errors) / current.totalRequests) * 100;

    // Calculate average latency (weighted)
    current.latency = (current.latency * 0.8) + (latency * 0.2);

    // Determine status
    if (current.successRate < 80) {
      current.status = 'unhealthy';
    } else if (current.successRate < 95) {
      current.status = 'degraded';
    } else {
      current.status = 'healthy';
    }

    current.lastCheck = new Date();

    this.healthData.set(provider, current);
    return current;
  }

  private async pingProvider(provider: string): Promise<void> {
    // Implement provider-specific ping
    switch (provider) {
      case 'alchemy':
        await this.pingAlchemy();
        break;
      case 'moralis':
        await this.pingMoralis();
        break;
      case 'infura':
        await this.pingInfura();
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  private async pingAlchemy(): Promise<void> {
    // Simulate Alchemy ping
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async pingMoralis(): Promise<void> {
    // Simulate Moralis ping
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  private async pingInfura(): Promise<void> {
    // Simulate Infura ping
    await new Promise(resolve => setTimeout(resolve, 150));
  }
}