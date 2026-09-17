// app/api/prices/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// ============================================================
// SETUP
// ============================================================

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;

let redis: Redis | null = null;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    console.log('✅ Redis configured');
  } else {
    console.warn('⚠️ Redis env vars missing, running without cache');
  }
} catch (e) {
  console.warn('⚠️ Redis initialization failed, running without cache:', e);
}

const ALCHEMY_PRICE_CHAINS: Record<string, string> = {
  ethereum: 'eth-mainnet',
  polygon: 'polygon-mainnet',
  bsc: 'bnb-mainnet',
  arbitrum: 'arb-mainnet',
  optimism: 'opt-mainnet',
  avalanche: 'avax-mainnet',
  base: 'base-mainnet',
};

const GECKOTERMINAL_NETWORKS: Record<string, string> = {
  ethereum: 'eth',
  polygon: 'polygon_pos',
  bsc: 'bsc',
  arbitrum: 'arbitrum',
  optimism: 'optimism',
  avalanche: 'avax',
  base: 'base',
};

let coinGeckoCooldown = 0;

interface PriceData {
  usd: number;
  symbol?: string;
  source: string;
}

type PriceMap = Record<string, PriceData>;

// ============================================================
// CACHE LAYER
// ============================================================

async function getCachedPrices(addresses: string[], chain: string): Promise<PriceMap> {
  if (!redis || addresses.length === 0) return {};

  try {
    const keys = addresses.map(a => `px:${chain}:${a.toLowerCase()}`);
    const values = await redis.mget<(PriceData | null)[]>(...keys);

    const result: PriceMap = {};
    addresses.forEach((addr, i) => {
      const value = values[i];
      if (
        value &&
        typeof value === 'object' &&
        'usd' in value &&
        typeof value.usd === 'number' &&
        value.usd > 0
      ) {
        result[addr.toLowerCase()] = value;
      }
    });
    return result;
  } catch (e) {
    console.warn('Cache read error:', e);
    return {};
  }
}

async function setCachedPrices(prices: PriceMap, chain: string, ttl: number): Promise<void> {
  if (!redis) return;

  const entries = Object.entries(prices).filter(
    ([_, data]) => data && typeof data.usd === 'number' && data.usd > 0
  );

  if (entries.length === 0) return;

  try {
    const pipeline = redis.pipeline();
    for (const [addr, data] of entries) {
      pipeline.set(`px:${chain}:${addr}`, data, { ex: ttl });
    }
    await pipeline.exec();
    console.log(`📦 Cache write: ${entries.length} prices cached`);
  } catch (e) {
    console.warn('Cache write error:', e);
  }
}

// ============================================================
// MAIN HANDLER
// ============================================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const addressesParam = searchParams.get('addresses');
  const symbolsParam = searchParams.get('symbols');
  const chain = (searchParams.get('chain') || 'ethereum').toLowerCase();

  console.log('🔑 Prices request:', {
    alchemy: !!ALCHEMY_API_KEY,
    redis: !!redis,
    chain,
    addressCount: addressesParam?.split(',').filter(Boolean).length || 0,
  });

  if (!addressesParam && !symbolsParam) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  const addresses = (addressesParam?.split(',').filter(Boolean) || [])
    .map(a => a.toLowerCase())
    .filter(a => a !== '0x0000000000000000000000000000000000000000');

  const symbols = symbolsParam?.split(',').filter(Boolean) || [];

  if (addresses.length === 0 && symbols.length === 0) {
    return NextResponse.json({});
  }

  if (addresses.length > 100) {
    return NextResponse.json({ error: 'Maximum 100 addresses' }, { status: 400 });
  }

  const prices: PriceMap = {};

  // ============================================================
  // STEP 1: Redis cache
  // ============================================================
  const cached = await getCachedPrices(addresses, chain);
  Object.assign(prices, cached);
  console.log(`📦 Cache hit: ${Object.keys(cached).length}/${addresses.length}`);

  // ============================================================
  // STEP 2: Alchemy Prices API
  // ============================================================
  const missingFromCache = addresses.filter(a => !prices[a]);

  if (missingFromCache.length > 0 && ALCHEMY_API_KEY) {
    const alchemyPrices = await fetchFromAlchemy(missingFromCache, chain);
    Object.assign(prices, alchemyPrices);
    console.log(`✅ Alchemy: +${Object.keys(alchemyPrices).length} prices`);
    await setCachedPrices(alchemyPrices, chain, 60);
  }

  // ============================================================
  // STEP 3: CoinGecko
  // ============================================================
  const stillMissing = addresses.filter(a => !prices[a]);

  if (stillMissing.length > 0) {
    const now = Date.now();
    if (now > coinGeckoCooldown) {
      const cgPrices = await fetchFromCoinGecko(stillMissing, []);
      Object.assign(prices, cgPrices);
      console.log(`✅ CoinGecko: +${Object.keys(cgPrices).length} prices`);
      await setCachedPrices(cgPrices, chain, 300);

      if (Object.keys(cgPrices).length === 0) {
        coinGeckoCooldown = now + 30000;
      }
    } else {
      console.log(`⏸️ CoinGecko in cooldown`);
    }
  }

  // ============================================================
  // ✅ STEP 3.5: GeckoTerminal (long-tail tokens like YRISE)
  // ============================================================
  const stillMissingAfterCG = addresses.filter(a => !prices[a]);

  if (stillMissingAfterCG.length > 0) {
    console.log(`🔄 Trying GeckoTerminal for ${stillMissingAfterCG.length} long-tail tokens`);
    const gtPrices = await fetchFromGeckoTerminal(stillMissingAfterCG, chain);
    Object.assign(prices, gtPrices);
    console.log(`✅ GeckoTerminal: +${Object.keys(gtPrices).length} prices`);
    await setCachedPrices(gtPrices, chain, 600);
  }

  // ============================================================
  // STEP 4: Symbols
  // ============================================================
  if (symbols.length > 0) {
    const symbolPrices = await fetchSymbolsViaCoinGecko(symbols);
    for (const [sym, priceData] of Object.entries(symbolPrices)) {
      prices[sym] = priceData;
    }
  }

  console.log(`📤 Returning ${Object.keys(prices).length} prices`);

  return NextResponse.json(prices, {
    headers: {
      'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
    },
  });
}

// ============================================================
// ALCHEMY PRICES API
// ============================================================

async function fetchFromAlchemy(addresses: string[], chain: string): Promise<PriceMap> {
  if (!ALCHEMY_API_KEY || addresses.length === 0) return {};

  const alchemyChain = ALCHEMY_PRICE_CHAINS[chain] || 'eth-mainnet';
  const prices: PriceMap = {};

  try {
    const BATCH_SIZE = 25;

    for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
      const batch = addresses.slice(i, i + BATCH_SIZE);

      const response = await fetch(
        `https://api.g.alchemy.com/prices/v1/${ALCHEMY_API_KEY}/tokens/by-address`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            addresses: batch.map(addr => ({
              network: alchemyChain,
              address: addr,
            })),
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Alchemy ${response.status}: ${errorText.slice(0, 150)}`);
        continue;
      }

      const data = await response.json();

      if (data.data && Array.isArray(data.data)) {
        for (const token of data.data) {
          const addr = token.address?.toLowerCase();
          const priceValue = token.prices?.[0]?.value;

          if (addr && priceValue) {
            const numericPrice = typeof priceValue === 'string'
              ? parseFloat(priceValue)
              : priceValue;

            if (!isNaN(numericPrice) && numericPrice > 0) {
              prices[addr] = {
                usd: numericPrice,
                symbol: token.symbol,
                source: 'alchemy',
              };
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Alchemy fetch error:', error);
  }

  return prices;
}

// ============================================================
// ✅ GECKOTERMINAL (Tier 3 - long-tail tokens)
// ============================================================

async function fetchFromGeckoTerminal(
  addresses: string[],
  chain: string
): Promise<PriceMap> {
  if (addresses.length === 0) return {};

  const network = GECKOTERMINAL_NETWORKS[chain] || 'eth';
  const prices: PriceMap = {};

  for (const addr of addresses) {
    try {
      const url = `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${addr.toLowerCase()}`;

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Crypto-Wallet-Tracker/1.0',
        },
      });

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      const priceUsd = data.data?.attributes?.price_usd;
      const symbol = data.data?.attributes?.symbol;

      if (priceUsd && parseFloat(priceUsd) > 0) {
        prices[addr.toLowerCase()] = {
          usd: parseFloat(priceUsd),
          symbol: symbol || undefined,
          source: 'geckoterminal',
        };
        console.log(`  ✅ GeckoTerminal: ${symbol} = $${priceUsd}`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch {
      continue;
    }
  }

  return prices;
}

// ============================================================
// COINGECKO FALLBACK
// ============================================================

const ADDRESS_TO_COINGECKO: Record<string, Record<string, string>> = {
  ethereum: {
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'ethereum',
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'usd-coin',
    '0xdac17f958d2ee523a2206206994597c13d831ec7': 'tether',
    '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 'wrapped-bitcoin',
    '0x6b175474e89094c44da98b954eedeac495271d0f': 'dai',
    '0x514910771af9ca656af840dff83e8264ecf986ca': 'chainlink',
    '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': 'uniswap',
    '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0': 'matic-network',
    '0x15b7c0c907e4c6b9adaaaabc300c08991d6cea05': 'gelato',
    '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2': 'maker',
    '0xd533a949740bb3306d119cc777fa900ba034cd52': 'curve-dao-token',
    '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': 'aave',
    '0x0d8775f648430679a709e98d2b0cb6250d2887ef': 'basic-attention-token',
  },
  polygon: {
    '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270': 'wmatic',
    '0x2791bca1f2de4661ed88a30c99a7a9449aa84174': 'usd-coin',
    '0xc2132d05d31c914a87c6611c10748aeb04b58e8f': 'tether',
    '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619': 'weth',
  },
  bsc: {
    '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c': 'binancecoin',
    '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': 'usd-coin',
    '0x55d398326f99059ff775485246999027b3197955': 'tether',
  },
  arbitrum: {
    '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': 'ethereum',
    '0xaf88d065e77c8cc2239327c5edb3a432268e5831': 'usd-coin',
    '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': 'tether',
  },
  optimism: {
    '0x4200000000000000000000000000000000000006': 'ethereum',
    '0x0b2c639c533813f4aa9d7837caf62653d097ff85': 'usd-coin',
    '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58': 'tether',
  },
  base: {
    '0x4200000000000000000000000000000000000006': 'ethereum',
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 'usd-coin',
  },
};

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
  GEL: 'gelato',
  BNB: 'binancecoin',
  AVAX: 'avalanche-2',
  SOL: 'solana',
  AAVE: 'aave',
  MKR: 'maker',
  CRV: 'curve-dao-token',
  BAT: 'basic-attention-token',
};

async function fetchFromCoinGecko(addresses: string[], _symbols: string[]): Promise<PriceMap> {
  if (addresses.length === 0) return {};

  try {
    const addressToCgId: Record<string, string> = {};

    for (const addr of addresses) {
      const lower = addr.toLowerCase();
      for (const chainMap of Object.values(ADDRESS_TO_COINGECKO)) {
        const cgId = chainMap[lower];
        if (cgId) {
          addressToCgId[lower] = cgId;
          break;
        }
      }
    }

    const ids = Array.from(new Set(Object.values(addressToCgId)));

    if (ids.length === 0) return {};

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'Crypto-Wallet-Tracker/1.0',
    };

    if (COINGECKO_API_KEY) {
      headers['x-cg-pro-api-key'] = COINGECKO_API_KEY;
    }

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn('⚠️ CoinGecko rate limited');
      }
      return {};
    }

    const data = await response.json();
    const prices: PriceMap = {};

    for (const [address, cgId] of Object.entries(addressToCgId)) {
      if (data[cgId]?.usd) {
        prices[address] = {
          usd: data[cgId].usd,
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

async function fetchSymbolsViaCoinGecko(symbols: string[]): Promise<PriceMap> {
  if (symbols.length === 0) return {};

  const ids = symbols
    .map(s => SYMBOL_TO_COINGECKO[s.toUpperCase()])
    .filter(Boolean);

  if (ids.length === 0) return {};

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'Crypto-Wallet-Tracker/1.0',
    };

    if (COINGECKO_API_KEY) {
      headers['x-cg-pro-api-key'] = COINGECKO_API_KEY;
    }

    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`,
      { headers }
    );

    if (!response.ok) return {};

    const data = await response.json();
    const prices: PriceMap = {};

    for (const sym of symbols) {
      const upper = sym.toUpperCase();
      const cgId = SYMBOL_TO_COINGECKO[upper];
      if (cgId && data[cgId]?.usd) {
        prices[upper] = {
          usd: data[cgId].usd,
          symbol: upper,
          source: 'coingecko',
        };
      }
    }

    return prices;
  } catch {
    return {};
  }
}