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
// MAIN PRICE FETCHER - Uses Server API Route
// ============================================================

/**
 * Fetch prices from Alchemy via the secure server API route
 * ✅ Key is NEVER exposed to the client
 */
export async function getTokenPrices(symbols: string[]): Promise<PriceData[]> {
  // Get addresses for the symbols
  const validSymbols = symbols
    .map(s => s.toUpperCase())
    .filter(s => TOKEN_ADDRESSES[s]);

  if (validSymbols.length === 0) {
    console.warn('⚠️ No valid token addresses found');
    return symbols.map(s => ({
      symbol: s.toUpperCase(),
      name: TOKEN_NAMES[s.toUpperCase()] || s,
      price: 0,
      priceChange24h: 0,
      lastUpdated: new Date().toISOString(),
    }));
  }

  const addresses = validSymbols.map(s => TOKEN_ADDRESSES[s]);
  console.log(`🔍 Fetching prices for ${validSymbols.length} tokens via server API...`);

  try {
    // ✅ Call our secure server API route
    // The API key is stored on the server, not in the client
    const response = await fetch(
      `/api/prices?addresses=${addresses.join(',')}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Server API error (${response.status}):`, errorText);
      throw new Error(`Server API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data || !data.data) {
      throw new Error('Invalid response from server API');
    }

    // Parse the response
    const results: PriceData[] = validSymbols.map((symbol) => {
      const address = TOKEN_ADDRESSES[symbol];
      const tokenData = data.data[address.toLowerCase()];
      
      let price = 0;
      
      if (tokenData && tokenData.prices && tokenData.prices.length > 0) {
        price = tokenData.prices[0].value || 0;
      }

      return {
        symbol: symbol,
        name: TOKEN_NAMES[symbol] || symbol,
        price: price,
        priceChange24h: 0,
        lastUpdated: new Date().toISOString(),
      };
    });

    const hasValidPrices = results.some(p => p.price > 0);
    if (!hasValidPrices) {
      console.warn('⚠️ No valid prices returned from server API');
      // Return zeros instead of failing
      return results;
    }

    console.log(`✅ Successfully fetched ${results.filter(p => p.price > 0).length} prices`);
    return results;

  } catch (error) {
    console.error('❌ Failed to fetch prices:', error);
    // Return zeros instead of failing
    return validSymbols.map(s => ({
      symbol: s,
      name: TOKEN_NAMES[s] || s,
      price: 0,
      priceChange24h: 0,
      lastUpdated: new Date().toISOString(),
    }));
  }
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