// src/lib/providers/provider.factory.ts
import { BlockchainProvider } from './provider.interface';
import { AlchemyProvider } from './alchemy.provider';
import { MoralisProvider } from './moralis.provider';
import { InfuraProvider } from './infura.provider';

export class ProviderFactory {
  private static instance: ProviderFactory;
  private providers: Map<string, BlockchainProvider> = new Map();

  static getInstance(): ProviderFactory {
    if (!ProviderFactory.instance) {
      ProviderFactory.instance = new ProviderFactory();
    }
    return ProviderFactory.instance;
  }

  getProvider(chain: string, type: 'alchemy' | 'moralis' | 'infura'): BlockchainProvider {
    const key = `${chain}-${type}`;
    
    if (this.providers.has(key)) {
      return this.providers.get(key)!;
    }

    let provider: BlockchainProvider;
    const apiKey = process.env[`${type.toUpperCase()}_API_KEY`];

    if (!apiKey) {
      throw new Error(`${type} API key not found for chain ${chain}`);
    }

    switch (type) {
      case 'alchemy':
        provider = new AlchemyProvider(chain, apiKey);
        break;
      case 'moralis':
        provider = new MoralisProvider(chain, apiKey);
        break;
      case 'infura':
        provider = new InfuraProvider(chain, apiKey);
        break;
      default:
        throw new Error(`Unknown provider type: ${type}`);
    }

    this.providers.set(key, provider);
    return provider;
  }

  getProviderForData(
    chain: string,
    dataType: 'transactions' | 'balances' | 'history' | 'nfts' | 'prices'
  ): BlockchainProvider {
    // Smart routing based on data type
    const preferredProviders: Record<string, string[]> = {
      transactions: ['alchemy', 'moralis'],
      balances: ['moralis', 'alchemy'],
      history: ['moralis', 'alchemy'],
      nfts: ['moralis', 'alchemy'],
      prices: ['alchemy', 'moralis'],
    };

    const providers = preferredProviders[dataType] || ['alchemy', 'moralis'];
    
    for (const providerName of providers) {
      try {
        return this.getProvider(chain, providerName as 'alchemy' | 'moralis');
      } catch {
        continue;
      }
    }
    
    throw new Error(`No provider available for ${chain} - ${dataType}`);
  }
}