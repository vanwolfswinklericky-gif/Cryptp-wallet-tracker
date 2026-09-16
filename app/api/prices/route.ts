// app/api/prices/route.ts
import { NextRequest, NextResponse } from 'next/server';

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

// Chain mapping for Alchemy Prices API
const ALCHEMY_PRICE_CHAINS: Record<string, string> = {
  ethereum: 'eth-mainnet',
  polygon: 'polygon-mainnet',
  bsc: 'bnb-mainnet',
  arbitrum: 'arb-mainnet',
  optimism: 'opt-mainnet',
  avalanche: 'avax-mainnet',
  base: 'base-mainnet',
};

interface PriceData {
  usd: number;
  symbol?: string;
  source: string;
}

type PriceMap = Record<string, PriceData>;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const addressesParam = searchParams.get('addresses');
  const symbolsParam = searchParams.get('symbols');
  const chain = (searchParams.get('chain') || 'ethereum').toLowerCase();

  console.log('🔑 Env check:', {
    alchemyKeyPresent: !!ALCHEMY_API_KEY,
    alchemyKeyLength: ALCHEMY_API_KEY?.length || 0,
    chain,
  });

  if (!addressesParam && !symbolsParam) {
    return NextResponse.json(
      { error: 'Missing addresses or symbols parameter' },
      { status: 400 }
    );
  }

  const addresses = addressesParam?.split(',').filter(Boolean) || [];
  const symbols = symbolsParam?.split(',').filter(Boolean) || [];

  const prices: PriceMap = {};

  // ============================================================
  // Strategy 1: Try Alchemy Prices API (correct endpoint)
  // ============================================================
  if (ALCHEMY_API_KEY && addresses.length > 0) {
    try {
      const alchemyChain = ALCHEMY_PRICE_CHAINS[chain] || 'eth-mainnet';
      
      // ✅ Correct Alchemy Prices API URL
      const url = `https://api.g.alchemy.com/prices/v1/${ALCHEMY_API_KEY}/tokens/by-address`;
      
      console.log(`🔄 Calling Alchemy Prices API: ${url.replace(ALCHEMY_API_KEY, '***')}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addresses: addresses.map((addr) => ({
            network: alchemyChain,
            address: addr.toLowerCase(),
          })),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.data && Array.isArray(data.data)) {
          for (const token of data.data) {
            const address = token.address?.toLowerCase();
            const priceData = token.prices?.[0];
            
            if (address && priceData?.value) {
              prices[address] = {
                usd: priceData.value,
                symbol: token.symbol,
                source: 'alchemy',
              };
            }
          }
        }
        
        console.log(`✅ Alchemy Prices API: Got ${Object.keys(prices).length} prices`);
      } else {
        const errorText = await response.text();
        console.error(`❌ Alchemy Prices API ${response.status}: ${errorText.slice(0, 200)}`);
      }
    } catch (error) {
      console.error('❌ Alchemy Prices API error:', error);
    }
  }

  // ============================================================
  // Strategy 2: Fall back to CoinGecko for missing prices
  // ============================================================
  const missingAddresses = addresses.filter((addr) => !prices[addr.toLowerCase()]);

  if (missingAddresses.length > 0 || symbols.length > 0) {
    console.log(`🔄 Falling back to CoinGecko for ${missingAddresses.length} addresses + ${symbols.length} symbols`);
    
    const cgPrices = await fetchFromCoinGecko(missingAddresses, symbols);
    
    for (const [key, priceData] of Object.entries(cgPrices)) {
      if (!prices[key]) {
        prices[key] = priceData;
      }
    }
    
    console.log(`✅ CoinGecko: Got ${Object.keys(cgPrices).length} prices`);
  }

  return NextResponse.json(prices, {
    headers: {
      'Cache-Control': 's-maxage=60, stale-while-revalidate=120',
    },
  });
}

// ============================================================
// CoinGecko fallback
// ============================================================

// Known contract addresses → CoinGecko IDs
const ADDRESS_TO_COINGECKO: Record<string, string> = {
  // Ethereum Mainnet
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'usd-coin',
  '0xdac17f958d2ee523a2206206994597c13d831ec7': 'tether',
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 'wrapped-bitcoin',
  '0x514910771af9ca656af840dff83e8264ecf986ca': 'chainlink',
  '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': 'uniswap',
  '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0': 'matic-network',
  '0x6b175474e89094c44da98b954eedeac495271d0f': 'dai',
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'weth',
  '0x15b7c0c907e4c6b9adaaaabc300c08991d6cea05': 'gelato', // ✅ GEL
};

// Symbol → CoinGecko IDs
const SYMBOL_TO_COINGECKO: Record<string, string> = {
  ETH: 'ethereum',
  BTC: 'bitcoin',
  USDC: 'usd-coin',
  USDT: 'tether',
  WBTC: 'wrapped-bitcoin',
  LINK: 'chainlink',
  UNI: 'uniswap',
  MATIC: 'matic-network',
  DAI: 'dai',
  WETH: 'weth',
  GEL: 'gelato', // ✅ GEL
};

async function fetchFromCoinGecko(
  addresses: string[],
  symbols: string[]
): Promise<PriceMap> {
  try {
    const ids = new Set<string>();
    const addressToId: Record<string, string> = {};

    // Map addresses to CoinGecko IDs
    for (const addr of addresses) {
      const lower = addr.toLowerCase();
      const cgId = ADDRESS_TO_COINGECKO[lower];
      if (cgId) {
        ids.add(cgId);
        addressToId[lower] = cgId;
      }
    }

    // Map symbols to CoinGecko IDs
    for (const sym of symbols) {
      const cgId = SYMBOL_TO_COINGECKO[sym.toUpperCase()];
      if (cgId) {
        ids.add(cgId);
      }
    }

    if (ids.size === 0) {
      console.warn('⚠️ No CoinGecko IDs mapped — returning empty prices');
      return {};
    }

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${Array.from(ids).join(',')}&vs_currencies=usd`;
    console.log(`🔄 CoinGecko request: ${url}`);

    const response = await fetch(url, {
      headers: { 
        Accept: 'application/json',
        'User-Agent': 'Crypto-Wallet-Tracker/1.0',
      },
    });

    if (!response.ok) {
      console.error(`❌ CoinGecko ${response.status}: ${response.statusText}`);
      return {};
    }

    const data = await response.json();
    const prices: PriceMap = {};

    // Map results back to addresses
    for (const [address, cgId] of Object.entries(addressToId)) {
      if (data[cgId]?.usd) {
        prices[address] = {
          usd: data[cgId].usd,
          source: 'coingecko',
        };
      }
    }

    // Map results to symbols
    for (const sym of symbols) {
      const upperSym = sym.toUpperCase();
      const cgId = SYMBOL_TO_COINGECKO[upperSym];
      if (cgId && data[cgId]?.usd) {
        prices[upperSym] = {
          usd: data[cgId].usd,
          symbol: upperSym,
          source: 'coingecko',
        };
      }
    }

    return prices;
  } catch (error) {
    console.error('❌ CoinGecko error:', error);
    return {};
  }
}