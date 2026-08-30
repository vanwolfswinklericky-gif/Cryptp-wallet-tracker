// src/lib/providers/provider-fallback.service.ts
import { logger } from '@/lib/logger';
import { RawEvidenceService } from '@/lib/services/raw-evidence.service';

export class ProviderFallbackService {
  private static instance: ProviderFallbackService;
  private providers: Map<string, any> = new Map();
  private providerStatus: Map<string, { healthy: boolean; lastCheck: Date; latency: number }> = new Map();

  private constructor() {
    // Initialize providers
    this.providers.set('alchemy', { name: 'alchemy', priority: 1 });
    this.providers.set('moralis', { name: 'moralis', priority: 2 });
    this.providers.set('infura', { name: 'infura', priority: 3 });
  }

  static getInstance(): ProviderFallbackService {
    if (!ProviderFallbackService.instance) {
      ProviderFallbackService.instance = new ProviderFallbackService();
    }
    return ProviderFallbackService.instance;
  }

  /**
   * Get data from best available provider - AUTOMATIC FALLBACK
   */
  async getDataWithFallback<T>(
    chain: string,
    walletAddress: string,
    dataType: 'transactions' | 'balances' | 'history',
    options?: any
  ): Promise<{ data: T; provider: string } | null> {
    const providers = this.getProvidersByPriority();

    for (const provider of providers) {
      try {
        const isHealthy = await this.checkProviderHealth(provider);
        if (!isHealthy) continue;

        const data = await this.fetchFromProvider<T>(provider, chain, walletAddress, dataType, options);
        if (data) {
          logger.info(`Data fetched from ${provider} for ${walletAddress}`);
          return { data, provider };
        }
      } catch (error) {
        logger.warn(`Provider ${provider} failed:`, error);
        this.markProviderUnhealthy(provider);
      }
    }

    logger.error(`All providers failed for ${walletAddress}`);
    return null;
  }

  private getProvidersByPriority(): string[] {
    return Array.from(this.providers.keys())
      .sort((a, b) => (this.providers.get(a)?.priority || 99) - (this.providers.get(b)?.priority || 99));
  }

  private async checkProviderHealth(provider: string): Promise<boolean> {
    const status = this.providerStatus.get(provider);
    if (!status) return true;
    
    // If checked within last minute, return cached status
    if (status.lastCheck > new Date(Date.now() - 60000)) {
      return status.healthy;
    }

    // Check health
    try {
      const start = Date.now();
      // Make a lightweight health check
      await this.pingProvider(provider);
      const latency = Date.now() - start;
      
      this.providerStatus.set(provider, {
        healthy: true,
        lastCheck: new Date(),
        latency,
      });
      return true;
    } catch (error) {
      this.providerStatus.set(provider, {
        healthy: false,
        lastCheck: new Date(),
        latency: 9999,
      });
      return false;
    }
  }

  private async fetchFromProvider<T>(
    provider: string,
    chain: string,
    walletAddress: string,
    dataType: string,
    options?: any
  ): Promise<T | null> {
    // Implement provider-specific fetching
    // This is a placeholder
    return null as T;
  }

  private async pingProvider(provider: string): Promise<void> {
    // Implement provider ping
    // This is a placeholder
  }

  private markProviderUnhealthy(provider: string): void {
    this.providerStatus.set(provider, {
      healthy: false,
      lastCheck: new Date(),
      latency: 9999,
    });
  }

  /**
   * Get provider status - MONITORING
   */
  getProviderStatus() {
    return Array.from(this.providerStatus.entries()).map(([name, status]) => ({
      name,
      healthy: status.healthy,
      latency: status.latency,
      lastCheck: status.lastCheck,
    }));
  }
}