// src/lib/prices.ts

// ============================================================
// TOKEN MAPPINGS (CoinGecko IDs)
// ============================================================

const SYMBOL_TO_ID: Record<string, string> = {
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
  'BTC': 'bitcoin',
  'DOGE': 'dogecoin',
  'DOT': 'polkadot',
  'ADA': 'cardano',
  'LTC': 'litecoin',
  'BCH': 'bitcoin-cash',
  'XRP': 'ripple',
  'ATOM': 'cosmos',
  'NEAR': 'near',
  'APT': 'aptos',
  'SUI': 'sui',
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
  'BTC': 'Bitcoin',
  'DOGE': 'Dogecoin',
  'DOT': 'Polkadot',
  'ADA': 'Cardano',
  'LTC': 'Litecoin',
  'BCH': 'Bitcoin Cash',
  'XRP': 'XRP',
  'ATOM': 'Cosmos',
  'NEAR': 'NEAR Protocol',
  'APT': 'Aptos',
  'SUI': 'Sui',
};

// ============================================================
// SCAM TOKEN FILTER
// ============================================================

const SCAM_PATTERNS = [
  'SOFTCRYPT', 'CATE', 'NEIRO', 'BLINK', 'MATKA', 'HUB', 'SOBA',
  'VITALIK', 'WORMHOLE', 'CLAIM', 'REWARD', 'AIRDROP', 'BONUS',
  'FREE', 'TELEGRAM', 'T.ME', 'PROMO', 'GIVEAWAY', 'WIN', 'PRIZE',
];

const isScamToken = (symbol: string): boolean => {
  const upper = symbol.toUpperCase();
  return SCAM_PATTERNS.some(pattern => upper.includes(pattern));
};

// ============================================================
// MAIN PRICE FETCHING - CoinGecko ONLY
// ============================================================

export async function getMultipleTokenPrices(symbols: string[]): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  
  if (!symbols || symbols.length === 0) {
    symbols = ['ETH', 'USDC', 'WBTC', 'LINK', 'UNI', 'MATIC', 'BNB'];
  }

  try {
    // Filter scam tokens and duplicates
    const cleanSymbols = [...new Set(
      symbols
        .map(s => s.toUpperCase())
        .filter(s => !isScamToken(s))
        .filter(s => SYMBOL_TO_ID[s])
    )];

    if (cleanSymbols.length === 0) {
      console.warn('⚠️ No valid symbols after filtering');
      symbols.forEach(s => { result[s.toUpperCase()] = 0; });
      return result;
    }

    console.log(`🔍 Fetching ${cleanSymbols.length} token prices via CoinGecko...`);

    // ✅ ONLY CoinGecko via server API
    const response = await fetch(
      `/api/prices?symbols=${cleanSymbols.join(',')}`,
      {
        headers: { 'Accept': 'application/json' },
        cache: 'force-cache',
        next: { revalidate: 60 },
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    cleanSymbols.forEach(symbol => {
      result[symbol] = data[symbol] || 0;
    });

    const successCount = Object.values(result).filter(v => v > 0).length;
    console.log(`✅ Got ${successCount}/${cleanSymbols.length} prices from CoinGecko`);

    return result;

  } catch (error) {
    console.error('❌ Failed to fetch prices:', error);
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

export function getTokenName(symbol: string): string {
  return TOKEN_NAMES[symbol.toUpperCase()] || symbol;
}

export function isTokenSupported(symbol: string): boolean {
  return symbol.toUpperCase() in SYMBOL_TO_ID;
}

export function getSupportedTokens(): string[] {
  return Object.keys(SYMBOL_TO_ID);
}