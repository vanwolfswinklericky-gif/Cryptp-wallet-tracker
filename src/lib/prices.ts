// src/lib/prices.ts

interface PriceData {
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number;
  lastUpdated: string;
}

// ============================================================
// TOKEN ADDRESSES & MAPPINGS
// ============================================================

// Token addresses for Alchemy Price API
const TOKEN_ADDRESSES: Record<string, string> = {
  'ETH': '0x0000000000000000000000000000000000000000',
  'USDC': '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  'USDT': '0xdac17f958d2ee523a2206206994597c13d831ec7',
  'WBTC': '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
  'LINK': '0x514910771af9ca656af840dff83e8264ecf986ca',
  'UNI': '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
  'MATIC': '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0',
  'BNB': '0xb8c77482e45f1f44de1745f52c74426c631bdd52',
  'ARB': '0xb50721bcf8d664c30412cfbc6cf7a15145234ad1',
  'OP': '0x4200000000000000000000000000000000000042',
  'AVAX': '0x85f138bfee4ef8e540890cfb48f620571d67bda3',
  'DAI': '0x6b175474e89094c44da98b954eedeac495271d0f',
  'AAVE': '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
  'SOL': '0xd31a59c85ae9d8edefec411d448f90841571b89c',
  'MKR': '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2',
  'CRV': '0xd533a949740bb3306d119cc777fa900ba034cd52',
  'CVX': '0x4e3fbd56cd56c3e72c1403e103b45db9da5b9d2b',
};

// CoinGecko ID mappings (fallback)
const SYMBOL_TO_COINGECKO: Record<string, string> = {
  'ETH': 'ethereum',
  'USDC': 'usd-coin',
  'USDT': 'tether',
  'WBTC': 'wrapped-bitcoin',
  'LINK': 'chainlink',
  'UNI': 'uniswap',
  'MATIC': 'polygon',
  'BNB': 'binancecoin',
  'ARB': 'arbitrum',
  'OP': 'optimism',
  'AVAX': 'avalanche-2',
  'DAI': 'dai',
  'AAVE': 'aave',
  'SOL': 'solana',
  'MKR': 'maker',
  'CRV': 'curve-dao-token',
  'CVX': 'convex-finance',
};

// Token names for display
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

// ============================================================
// ALCHEMY PRICES API
// ============================================================

/**
 * Fetch prices from Alchemy Prices API
 * Free tier: 300 requests/hour
 * Docs: https://docs.alchemy.com/reference/prices-api
 */
async function fetchFromAlchemy(symbols: string[]): Promise<PriceData[]> {
  const apiKey = process.env.ALCHEMY_API_KEY;
  
  if (!apiKey) {
    console.warn('⚠️ ALCHEMY_API_KEY not set');
    throw new Error('Alchemy API key not configured');
  }

  // Get addresses for the symbols
  const validSymbols = symbols
    .map(s => s.toUpperCase())
    .filter(s => TOKEN_ADDRESSES[s]);

  if (validSymbols.length === 0) {
    throw new Error('No valid token addresses for Alchemy');
  }

  const addresses = validSymbols.map(s => TOKEN_ADDRESSES[s]);
  console.log(`🔍 Fetching Alchemy prices for: ${validSymbols.join(', ')}`);

  try {
    // Alchemy Prices API - by-address endpoint
    // Supports batch queries with comma-separated addresses
    const url = `https://api.g.alchemy.com/prices/v1/tokens/by-address?addresses=${addresses.join(',')}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Alchemy API error (${response.status}):`, errorText);
      throw new Error(`Alchemy API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Parse Alchemy response
    // Response format: { data: { [address]: { prices: [{ value, currency }] } } }
    if (!data || !data.data) {
      throw new Error('Invalid Alchemy response');
    }

    const results: PriceData[] = validSymbols.map((symbol) => {
      const address = TOKEN_ADDRESSES[symbol];
      const tokenData = data.data[address.toLowerCase()];
      
      let price = 0;
      let priceChange24h = 0;
      
      if (tokenData && tokenData.prices && tokenData.prices.length > 0) {
        // Get the latest price (usually the first one)
        const priceInfo = tokenData.prices[0];
        price = priceInfo.value || 0;
        // Alchemy returns price in USD by default
      }

      return {
        symbol: symbol,
        name: TOKEN_NAMES[symbol] || symbol,
        price: price,
        priceChange24h: priceChange24h,
        lastUpdated: new Date().toISOString(),
      };
    });

    const hasValidPrices = results.some(p => p.price > 0);
    if (!hasValidPrices) {
      console.warn('⚠️ Alchemy returned zero prices (rate limit or no data)');
      throw new Error('No valid prices from Alchemy');
    }

    console.log(`✅ Alchemy Prices API succeeded for ${results.filter(p => p.price > 0).length} tokens`);
    return results;

  } catch (error) {
    console.error('❌ Alchemy Prices API failed:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

// ============================================================
// COINGECKO API (Fallback)
// ============================================================

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

/**
 * Fetch prices from CoinGecko (free fallback)
 */
async function fetchFromCoinGecko(symbols: string[]): Promise<PriceData[]> {
  const validSymbols = symbols
    .map(s => s.toUpperCase())
    .filter(s => SYMBOL_TO_COINGECKO[s]);

  if (validSymbols.length === 0) {
    throw new Error('No valid CoinGecko symbols');
  }

  const ids = validSymbols.map(s => SYMBOL_TO_COINGECKO[s]).join(',');
  console.log(`🔍 Fetching CoinGecko prices for: ${validSymbols.join(', ')}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(
      `${COINGECKO_API}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
      {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data || Object.keys(data).length === 0) {
      throw new Error('No data from CoinGecko');
    }

    const results = validSymbols.map((symbol) => {
      const id = SYMBOL_TO_COINGECKO[symbol];
      const priceData = data[id];
      
      return {
        symbol: symbol,
        name: TOKEN_NAMES[symbol] || symbol,
        price: priceData?.usd || 0,
        priceChange24h: priceData?.usd_24h_change || 0,
        lastUpdated: new Date().toISOString(),
      };
    });

    const hasValidPrices = results.some(p => p.price > 0);
    if (!hasValidPrices) {
      throw new Error('No valid prices from CoinGecko');
    }

    console.log(`✅ CoinGecko succeeded for ${results.filter(p => p.price > 0).length} tokens`);
    return results;

  } catch (error) {
    console.error('❌ CoinGecko failed:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

// ============================================================
// MAIN FUNCTION WITH FALLBACKS
// ============================================================

/**
 * Fetch live prices with multiple fallback options
 * Order: Alchemy → CoinGecko
 * Both are free and work without API keys (CoinGecko) or with key (Alchemy)
 */
export async function getTokenPrices(symbols: string[]): Promise<PriceData[]> {
  const apiAttempts = [
    { name: 'Alchemy Prices API', fn: fetchFromAlchemy },
    { name: 'CoinGecko', fn: fetchFromCoinGecko },
  ];

  for (const attempt of apiAttempts) {
    try {
      console.log(`🔄 Trying ${attempt.name}...`);
      const result = await attempt.fn(symbols);
      
      const hasValidPrices = result.some(p => p.price > 0);
      if (hasValidPrices) {
        console.log(`✅ ${attempt.name} succeeded`);
        return result;
      }
    } catch (error) {
      console.warn(`⚠️ ${attempt.name} failed:`, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // All APIs failed - return zeros (no fallback prices)
  console.error('❌ All price APIs failed');
  return symbols.map(s => {
    const upper = s.toUpperCase();
    return {
      symbol: upper,
      name: TOKEN_NAMES[upper] || upper,
      price: 0,
      priceChange24h: 0,
      lastUpdated: new Date().toISOString(),
    };
  });
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get price for a single token
 */
export async function getTokenPrice(symbol: string): Promise<number> {
  const prices = await getTokenPrices([symbol]);
  return prices[0]?.price || 0;
}

/**
 * Get multiple token prices at once
 */
export async function getMultipleTokenPrices(symbols: string[]): Promise<Record<string, number>> {
  try {
    const prices = await getTokenPrices(symbols);
    const result: Record<string, number> = {};
    prices.forEach(p => {
      result[p.symbol] = p.price;
    });
    return result;
  } catch (error) {
    console.error('❌ Failed to get token prices:', error);
    // Return zeros instead of failing
    const result: Record<string, number> = {};
    symbols.forEach(s => {
      result[s] = 0;
    });
    return result;
  }
}

/**
 * Get token symbol by contract address
 */
export function getTokenSymbolByAddress(address: string): string | null {
  const ADDRESS_MAP: Record<string, string> = {
    '0xdac17f958d2ee523a2206206994597c13d831ec7': 'USDT',
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'USDC',
    '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 'WBTC',
    '0x514910771af9ca656af840dff83e8264ecf986ca': 'LINK',
    '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': 'UNI',
    '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0': 'MATIC',
    '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c': 'BNB',
    '0x912ce59144191c1204e64559fe8253a0e49e6548': 'ARB',
    '0x4200000000000000000000000000000000000042': 'OP',
    '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7': 'AVAX',
    '0x6b175474e89094c44da98b954eedeac495271d0f': 'DAI',
    '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': 'AAVE',
  };
  
  const normalizedAddress = address.toLowerCase();
  return ADDRESS_MAP[normalizedAddress] || null;
}

/**
 * Check if a token is supported by Alchemy
 */
export function isTokenSupportedByAlchemy(symbol: string): boolean {
  return symbol.toUpperCase() in TOKEN_ADDRESSES;
}

/**
 * Get all supported token symbols
 */
export function getSupportedTokens(): string[] {
  return Object.keys(TOKEN_ADDRESSES);
}