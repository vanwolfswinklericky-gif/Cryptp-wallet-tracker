'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import TokenLogo from './TokenLogo';

interface PriceData {
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number;
  currency: string;
}

interface Props {
  chain?: string;
  tokens?: { symbol: string; address: string; name: string; contractAddress?: string }[];
}

// Scam token patterns
const SCAM_SYMBOLS = [
  'BLINK', 'WWW.SOFTCRYPT.COM', 'MATKA', 'CATE', 'HUB', 'SOBA',
  'VITALIK', '0XWORMHOLE', 'NEIRO2.0', 'SOFTCRYPT', 'CATE.LIFE',
  'CLAIM', 'REWARD', 'AIRDROP', 'BONUS', 'FREE', 'T.ME', 'TELEGRAM',
  'GPT5.6', 'www.', '.com', '.life', '.today', '.link', 'PROMO',
  'GIVEAWAY', 'WIN', 'PRIZE', 'STAKING', 'VAULT', 'POOL',
];

// Known token names
const TOKEN_NAMES: Record<string, string> = {
  ETH: 'Ethereum',
  MATIC: 'Polygon',
  BNB: 'BNB',
  ARB: 'Arbitrum',
  OP: 'Optimism',
  AVAX: 'Avalanche',
  LINK: 'Chainlink',
  UNI: 'Uniswap',
  USDC: 'USD Coin',
  USDT: 'Tether',
  WBTC: 'Wrapped Bitcoin',
  DAI: 'Dai',
  SOL: 'Solana',
  BTC: 'Bitcoin',
  AAVE: 'Aave',
  MKR: 'Maker',
  CRV: 'Curve DAO',
  CVX: 'Convex Finance',
  GEL: 'Gelato Network', // ✅ NEW
};

// Token addresses for TokenLogo
const TOKEN_ADDRESSES: Record<string, string> = {
  ETH: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  WBTC: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
  LINK: '0x514910771af9ca656af840dff83e8264ecf986ca',
  UNI: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
  MATIC: '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0',
  BNB: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
  ARB: '0x912ce59144191c1204e64559fe8253a0e49e6548',
  OP: '0x4200000000000000000000000000000000000042',
  AVAX: '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7',
  DAI: '0x6b175474e89094c44da98b954eedeac495271d0f',
  AAVE: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
  MKR: '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2',
  CRV: '0xd533a949740bb3306d119cc777fa900ba034cd52',
  CVX: '0x4e3fbd56cd56c3e72c1403e103b45db9da5b9d2b',
  GEL: '0x15b7c0c907e4c6b9adaaaabc300c08991d6cea05', // ✅ NEW
};

const isScamToken = (symbol: string): boolean => {
  if (!symbol) return true;
  const upper = symbol.toUpperCase();
  return SCAM_SYMBOLS.some((scam) => upper.includes(scam) || scam.includes(upper));
};

const getTokenName = (symbol: string): string => TOKEN_NAMES[symbol] || symbol;

export default function LivePrices({ chain = 'ethereum', tokens = [] }: Props) {
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [apiFailed, setApiFailed] = useState(false);
  const [fetchedCount, setFetchedCount] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Build token list from props
  const buildTokenList = useCallback(() => {
    let tokenList: { symbol: string; address: string }[] = [];

    if (tokens && tokens.length > 0) {
      tokenList = tokens
        .map((t) => {
          const symbol = (t.symbol || (t as any).tokenSymbol)?.toUpperCase() || '';
          const address = t.address || (t as any).contractAddress || (t as any).tokenAddress || '';
          return { symbol, address };
        })
        .filter((t) => t.symbol && t.address)
        .filter((t) => !isScamToken(t.symbol))
        .slice(0, 50);
    }

    // Fallback to major tokens if no valid tokens
    if (tokenList.length === 0) {
      tokenList = [
        { symbol: 'ETH', address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' },
        { symbol: 'USDC', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' },
        { symbol: 'WBTC', address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599' },
        { symbol: 'LINK', address: '0x514910771af9ca656af840dff83e8264ecf986ca' },
        { symbol: 'UNI', address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984' },
      ];
    }

    return tokenList;
  }, [tokens]);

  // ✅ Fetch prices DIRECTLY from /api/prices (the working endpoint)
  const fetchLivePrices = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (isRefreshing) return;

    setIsRefreshing(true);
    setApiFailed(false);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const tokenList = buildTokenList();
      if (tokenList.length === 0) {
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      const addresses = tokenList.map((t) => t.address.toLowerCase()).join(',');
      const url = `/api/prices?addresses=${addresses}&chain=${chain}`;

      console.log(`🔍 Fetching prices for ${tokenList.length} tokens...`);
      console.log(`   URL: ${url.slice(0, 120)}...`);

      const response = await fetch(url, { signal: controller.signal });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      // ✅ Server returns { [address]: { usd, source } }
      const rawData: Record<string, { usd: number | string; source: string }> =
        await response.json();

      console.log(`📊 Received prices:`, rawData);

      // ✅ Normalize prices (string → number) and map to tokens
      const formattedPrices: PriceData[] = tokenList.map((token) => {
        const addr = token.address.toLowerCase();
        const priceEntry = rawData[addr];
        const rawPrice = priceEntry?.usd;
        const price =
          typeof rawPrice === 'string' ? parseFloat(rawPrice) :
          typeof rawPrice === 'number' ? rawPrice : 0;

        return {
          symbol: token.symbol,
          name: getTokenName(token.symbol),
          price: isNaN(price) ? 0 : price,
          priceChange24h: 0,
          currency: 'USD',
        };
      });

      const validCount = formattedPrices.filter((p) => p.price > 0).length;
      setFetchedCount(validCount);
      setPrices(formattedPrices);
      setApiFailed(validCount === 0);
      setLastUpdated(new Date());

      console.log(`✅ LivePrices updated with ${validCount} real prices`);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('❌ Failed to fetch live prices:', error);
      setApiFailed(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [buildTokenList, chain, isRefreshing]);

  // ✅ Initial fetch and periodic refresh
  useEffect(() => {
    fetchLivePrices();
    const interval = setInterval(fetchLivePrices, 60000);
    return () => {
      clearInterval(interval);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens, chain]);

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-emerald-400';
    if (change < 0) return 'text-rose-400';
    return 'text-emerald-100/50';
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-3 h-3" />;
    if (change < 0) return <TrendingDown className="w-3 h-3" />;
    return <Minus className="w-3 h-3" />;
  };

  const formatPrice = (price: number) => {
    if (price === 0) return '—';
    if (price < 0.001) return `$${price.toFixed(6)}`;
    if (price < 0.01) return `$${price.toFixed(5)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    if (price < 100) return `$${price.toFixed(2)}`;
    return `$${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-emerald-900/30" />
              <div>
                <div className="h-3 w-12 bg-emerald-900/30 rounded" />
                <div className="h-2 w-16 bg-emerald-900/30 rounded mt-1" />
              </div>
            </div>
            <div className="text-right">
              <div className="h-3 w-16 bg-emerald-900/30 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-emerald-900/30">
        <div className="flex items-center gap-2">
          {apiFailed ? (
            <span className="text-[10px] text-amber-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Limited data
            </span>
          ) : (
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {fetchedCount} live prices
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[10px] text-emerald-100/40">
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchLivePrices}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg text-emerald-100/50 transition-colors hover:bg-emerald-500/10 hover:text-emerald-300 disabled:opacity-50"
            title="Refresh prices"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Price list */}
      {prices.map((item) => {
        const hasPrice = item.price > 0;
        return (
          <div
            key={item.symbol}
            className="flex items-center justify-between p-2 rounded-xl transition-colors hover:bg-emerald-500/5"
          >
            <div className="flex items-center gap-3">
              <TokenLogo
                chain={chain}
                address={TOKEN_ADDRESSES[item.symbol] || '0x0000000000000000000000000000000000000000'}
                symbol={item.symbol}
                size={32}
              />
              <div>
                <p className="text-sm font-semibold text-white">{item.symbol}</p>
                <p className="text-xs text-emerald-100/50">{item.name}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-sm font-semibold ${hasPrice ? 'text-white' : 'text-emerald-100/30'}`}>
                {formatPrice(item.price)}
              </p>
              {hasPrice && item.priceChange24h !== 0 && (
                <div className={`flex items-center justify-end gap-1 text-xs font-medium ${getChangeColor(item.priceChange24h)}`}>
                  {getChangeIcon(item.priceChange24h)}
                  {Math.abs(item.priceChange24h).toFixed(2)}%
                </div>
              )}
            </div>
          </div>
        );
      })}

      {prices.length === 0 && (
        <div className="text-center text-xs text-emerald-100/40 py-6">
          No tokens to display
        </div>
      )}
    </div>
  );
}