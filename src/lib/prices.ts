// src/lib/prices.ts

// ============================================================
// PRICE FETCHING - Using Contract Addresses (No Mapping!)
// ✅ Works for ANY token on Ethereum and EVM chains
// ✅ No manual token mapping needed
// ✅ Handles thousands of tokens automatically
// ============================================================

// Token names for display (optional, just for UI)
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
// SCAM TOKEN FILTER (Pattern-based)
// ============================================================

const SCAM_PATTERNS = [
  'SOFTCRYPT', 'CATE', 'NEIRO', 'BLINK', 'MATKA', 'HUB', 'SOBA',
  'VITALIK', 'WORMHOLE', 'CLAIM', 'REWARD', 'AIRDROP', 'BONUS',
  'FREE', 'TELEGRAM', 'T.ME', 'PROMO', 'GIVEAWAY', 'WIN', 'PRIZE',
  'GPT5.6', 'www.', '.com', '.life', '.today', '.link',
];

const isScamToken = (symbol: string): boolean => {
  const upper = symbol.toUpperCase();
  return SCAM_PATTERNS.some(pattern => upper.includes(pattern));
};

// ============================================================
// MAIN PRICE FETCHING - Address-based (No Mapping!)
// ============================================================

/**
 * ✅ Get prices using token contract addresses
 * ✅ Works for ANY token - no manual mapping needed!
 * ✅ Uses Alchemy Prices API with CoinGecko fallback
 */
export async function getMultipleTokenPrices(
  tokens: { symbol: string; address: string }[]
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  
  if (!tokens || tokens.length === 0) {
    return result;
  }

  // ✅ Filter out scam tokens and invalid addresses
  const validTokens = tokens
    .filter(t => t.address && t.address.startsWith('0x') && t.address.length === 42)
    .filter(t => !isScamToken(t.symbol))
    .slice(0, 50); // Limit to 50 tokens to avoid rate limits

  if (validTokens.length === 0) {
    console.warn('⚠️ No valid tokens for price fetch');
    tokens.forEach(t => { result[t.symbol] = 0; });
    return result;
  }

  try {
    // ✅ Try Alchemy first (primary)
    const addresses = validTokens.map(t => t.address).join(',');
    
    console.log(`🔍 Fetching prices for ${validTokens.length} tokens via Alchemy...`);

    const alchemyResponse = await fetch(
      `/api/prices?addresses=${addresses}`,
      {
        headers: { 'Accept': 'application/json' },
        cache: 'force-cache',
        next: { revalidate: 60 },
      }
    );

    if (alchemyResponse.ok) {
      const data = await alchemyResponse.json();
      
      // ✅ Map prices back to symbols
      validTokens.forEach(token => {
        const priceData = data.data?.[token.address.toLowerCase()];
        result[token.symbol] = priceData?.prices?.[0]?.value || 0;
      });

      const successCount = Object.values(result).filter(v => v > 0).length;
      console.log(`✅ Alchemy: Got ${successCount}/${validTokens.length} prices`);
      
      // If we got at least some prices, return them
      if (successCount > 0) {
        return result;
      }
    }

    // ✅ Fallback to CoinGecko (if Alchemy fails)
    console.log('🔄 Alchemy failed or returned no prices, trying CoinGecko...');
    
    // Extract symbols for CoinGecko
    const symbols = validTokens.map(t => t.symbol);
    const geckoResponse = await fetch(
      `/api/prices?symbols=${symbols.join(',')}`,
      {
        headers: { 'Accept': 'application/json' },
        cache: 'force-cache',
        next: { revalidate: 60 },
      }
    );

    if (geckoResponse.ok) {
      const data = await geckoResponse.json();
      
      symbols.forEach(symbol => {
        result[symbol] = data[symbol] || 0;
      });

      const successCount = Object.values(result).filter(v => v > 0).length;
      console.log(`✅ CoinGecko: Got ${successCount}/${validTokens.length} prices`);
      return result;
    }

    // ✅ If all fails, return zeros
    console.warn('⚠️ All price sources failed');
    validTokens.forEach(t => {
      result[t.symbol] = 0;
    });
    return result;

  } catch (error) {
    console.error('❌ Failed to fetch prices:', error);
    validTokens.forEach(t => {
      result[t.symbol] = 0;
    });
    return result;
  }
}

export function getTokenName(symbol: string): string {
  return TOKEN_NAMES[symbol.toUpperCase()] || symbol;
}

export function formatPrice(price: number): string {
  if (price === 0) return '—';
  if (price < 0.01) return price.toFixed(6);
  if (price < 1) return price.toFixed(4);
  if (price < 1000) return price.toFixed(2);
  return price.toFixed(0);
}