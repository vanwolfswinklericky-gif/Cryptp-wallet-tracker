// src/lib/prices.ts

interface PriceData {
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number;
  lastUpdated: string;
}

// ============================================================
// COINCAP API (No API key needed, reliable)
// ============================================================

const COINCAP_API = 'https://api.coincap.io/v2';

// CoinCap asset IDs for major tokens
const SYMBOL_TO_COINCAP: Record<string, string> = {
  'ETH': 'ethereum',
  'USDC': 'usd-coin',
  'USDT': 'tether',
  'WBTC': 'wrapped-bitcoin',
  'LINK': 'chainlink',
  'UNI': 'uniswap',
  'MATIC': 'polygon',
  'BNB': 'binance-coin',
  'ARB': 'arbitrum',
  'OP': 'optimism',
  'AVAX': 'avalanche',
  'DAI': 'dai',
  'AAVE': 'aave',
  'SOL': 'solana',
  'MKR': 'maker',
  'CRV': 'curve-dao-token',
  'CVX': 'convex-finance',
};

const TOKEN_NAMES: Record<string, string> = {
  'ETH': 'Ethereum',
  'USDC': 'USD Coin',
  'USDT': 'Tether',
  'WBTC': 'Wrapped Bitcoin',
  'LINK': 'Chainlink',
  'UNI': 'Uniswap',
  'MATIC': 'Polygon',
  'BNB': 'BNB',
  'ARB': 'Arbitrum',
  'OP': 'Optimism',
  'AVAX': 'Avalanche',
  'DAI': 'Dai',
  'AAVE': 'Aave',
  'SOL': 'Solana',
  'MKR': 'Maker',
  'CRV': 'Curve DAO',
  'CVX': 'Convex Finance',
};

export async function getMultipleTokenPrices(symbols: string[]): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  
  // Default to major tokens if empty
  if (!symbols || symbols.length === 0) {
    symbols = ['ETH', 'USDC', 'WBTC', 'LINK', 'UNI', 'MATIC', 'BNB'];
  }

  try {
    // Filter symbols that have CoinCap mappings
    const validSymbols = symbols
      .map(s => s.toUpperCase())
      .filter(s => SYMBOL_TO_COINCAP[s]);

    if (validSymbols.length === 0) {
      console.warn('⚠️ No valid CoinCap symbols');
      return result;
    }

    const ids = validSymbols.map(s => SYMBOL_TO_COINCAP[s]).join(',');
    console.log(`🔍 Fetching CoinCap prices for: ${validSymbols.join(', ')}`);

    const response = await fetch(`${COINCAP_API}/assets?ids=${ids}`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`CoinCap API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.data || data.data.length === 0) {
      throw new Error('No data from CoinCap');
    }

    // Map results back to symbols
    data.data.forEach((item: any) => {
      const symbol = Object.keys(SYMBOL_TO_COINCAP).find(
        key => SYMBOL_TO_COINCAP[key] === item.id
      );
      if (symbol) {
        result[symbol] = parseFloat(item.priceUsd) || 0;
      }
    });

    console.log(`✅ CoinCap succeeded for ${Object.keys(result).length} tokens`);
    
    // Fill in any missing tokens with 0
    validSymbols.forEach(s => {
      if (!(s in result)) {
        result[s] = 0;
      }
    });

    return result;
  } catch (error) {
    console.error('❌ CoinCap failed:', error);
    // Return zeros for all requested symbols
    symbols.forEach(s => {
      result[s.toUpperCase()] = 0;
    });
    return result;
  }
}

export async function getTokenPrice(symbol: string): Promise<number> {
  const prices = await getMultipleTokenPrices([symbol]);
  return prices[symbol.toUpperCase()] || 0;
}