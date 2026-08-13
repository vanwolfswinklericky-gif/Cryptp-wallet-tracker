'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import TokenLogo from './TokenLogo';
import { getMultipleTokenPrices } from '@/lib/prices';

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

// ✅ Scam token patterns (expanded)
const SCAM_SYMBOLS = [
  'BLINK', 'WWW.SOFTCRYPT.COM', 'MATKA', 'CATE', 'HUB', 'SOBA',
  'VITALIK', '0XWORMHOLE', 'NEIRO2.0', 'SOFTCRYPT', 'CATE.LIFE',
  'CLAIM', 'REWARD', 'AIRDROP', 'BONUS', 'FREE', 'T.ME', 'TELEGRAM',
  'GPT5.6', 'www.', '.com', '.life', '.today', '.link', 'PROMO',
  'GIVEAWAY', 'WIN', 'PRIZE', 'STAKING', 'VAULT', 'POOL',
];

// ✅ Known token names for display
const TOKEN_NAMES: Record<string, string> = {
  'ETH': 'Ethereum',
  'MATIC': 'Polygon',
  'BNB': 'BNB',
  'ARB': 'Arbitrum',
  'OP': 'Optimism',
  'AVAX': 'Avalanche',
  'LINK': 'Chainlink',
  'UNI': 'Uniswap',
  'USDC': 'USD Coin',
  'USDT': 'Tether',
  'WBTC': 'Wrapped Bitcoin',
  'DAI': 'Dai',
  'SOL': 'Solana',
  'BTC': 'Bitcoin',
  'AAVE': 'Aave',
  'MKR': 'Maker',
  'CRV': 'Curve DAO',
  'CVX': 'Convex Finance',
  'DOG': 'Dogecoin',
  'BABYASTEROID': 'Baby Asteroid',
};

// ✅ Check if a symbol is a scam token
const isScamToken = (symbol: string): boolean => {
  if (!symbol) return true;
  const upper = symbol.toUpperCase();
  return SCAM_SYMBOLS.some(scam =>
    upper.includes(scam) || scam.includes(upper)
  );
};

const getTokenName = (symbol: string): string => {
  return TOKEN_NAMES[symbol] || symbol;
};

export default function LivePrices({ chain = 'ethereum', tokens = [] }: Props) {
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [apiFailed, setApiFailed] = useState(false);
  const [fetchedCount, setFetchedCount] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ✅ Build token list from props
  const buildTokenList = useCallback(() => {
    let tokenList: { symbol: string; address: string }[] = [];

    if (tokens && tokens.length > 0) {
      tokenList = tokens
        .map(t => {
          const symbol = (t.symbol || (t as any).tokenSymbol)?.toUpperCase() || '';
          const address = (t.address || (t as any).contractAddress) || '';
          return { symbol, address };
        })
        .filter(t => t.symbol && t.address)
        .filter(t => !isScamToken(t.symbol))
        .slice(0, 50);
    }

    // ✅ Fallback to major tokens if no valid tokens
    if (tokenList.length === 0) {
      tokenList = [
        { symbol: 'ETH', address: '0x0000000000000000000000000000000000000000' },
        { symbol: 'USDC', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' },
        { symbol: 'WBTC', address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599' },
        { symbol: 'LINK', address: '0x514910771af9ca656af840dff83e8264ecf986ca' },
        { symbol: 'UNI', address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984' },
        { symbol: 'MATIC', address: '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0' },
        { symbol: 'BNB', address: '0xb8c77482e45f1f44de1745f52c74426c631bdd52' },
      ];
    }

    return tokenList;
  }, [tokens]);

  // ✅ Fetch prices with timeout and retry
  const fetchLivePrices = useCallback(async () => {
    // Cancel any ongoing request
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
      console.log(`🔍 Fetching prices for ${tokenList.length} tokens...`);

      // ✅ Call with timeout (8 seconds)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 8000);
      });

      const fetchPromise = getMultipleTokenPrices(tokenList);
      const priceData = await Promise.race([fetchPromise, timeoutPromise]) as Record<string, number>;

      const validPrices = Object.values(priceData).filter(p => p > 0).length;
      setFetchedCount(validPrices);

      const formattedPrices: PriceData[] = tokenList.map(t => ({
        symbol: t.symbol,
        name: getTokenName(t.symbol),
        price: priceData[t.symbol] || 0,
        priceChange24h: 0,
        currency: 'USD',
      }));

      const hasValidPrices = formattedPrices.some(p => p.price > 0);

      if (hasValidPrices) {
        setPrices(formattedPrices);
        setApiFailed(false);
        setRetryCount(0);
        console.log(`✅ LivePrices updated with ${validPrices} real prices`);
      } else {
        // ✅ Retry logic - exponential backoff
        if (retryCount < 3) {
          console.warn(`⚠️ No valid prices, retrying (${retryCount + 1}/3)...`);
          setRetryCount(prev => prev + 1);
          setTimeout(() => {
            fetchLivePrices();
          }, Math.pow(2, retryCount) * 1000);
        } else {
          setPrices(formattedPrices);
          setApiFailed(true);
          console.warn('⚠️ No valid prices received after retries');
        }
      }

      setLastUpdated(new Date());
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('⏹️ Request cancelled');
        return;
      }

      console.error('❌ Failed to fetch live prices:', error);

      // ✅ Retry on error
      if (retryCount < 3) {
        console.warn(`⚠️ Error, retrying (${retryCount + 1}/3)...`);
        setRetryCount(prev => prev + 1);
        setTimeout(() => {
          fetchLivePrices();
        }, Math.pow(2, retryCount) * 1000);
      } else {
        setApiFailed(true);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [buildTokenList, retryCount]);

  // ✅ Initial fetch and auto-refresh
  useEffect(() => {
    fetchLivePrices();
    const interval = setInterval(fetchLivePrices, 60000); // Refresh every 60s
    return () => {
      clearInterval(interval);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [tokens, fetchLivePrices]);

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-green-600 dark:text-green-400';
    if (change < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-500 dark:text-gray-400';
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-3 h-3" />;
    if (change < 0) return <TrendingDown className="w-3 h-3" />;
    return <Minus className="w-3 h-3" />;
  };

  // ✅ Loading state with skeleton
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700" />
              <div>
                <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-2 w-16 bg-gray-200 dark:bg-gray-700 rounded mt-1" />
              </div>
            </div>
            <div className="text-right">
              <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-2 w-12 bg-gray-200 dark:bg-gray-700 rounded mt-1" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ✅ Header with status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {apiFailed ? (
            <span className="text-[10px] text-yellow-500 dark:text-yellow-400">
              ⚠️ Using limited data
            </span>
          ) : (
            <span className="text-[10px] text-green-500 dark:text-green-400">
              ✅ {fetchedCount} prices live
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchLivePrices}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            title="Refresh prices"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ✅ Price list */}
      {prices.map((item) => {
        const hasPrice = item.price > 0;
        return (
          <div
            key={item.symbol}
            className="flex items-center justify-between p-2 rounded-xl transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30"
          >
            <div className="flex items-center gap-3">
              <TokenLogo
                chain={chain}
                address={TOKEN_ADDRESSES[item.symbol] || '0x0000000000000000000000000000000000000000'}
                symbol={item.symbol}
                size={32}
              />
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {item.symbol}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {item.name}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-sm font-semibold ${hasPrice ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                {hasPrice ? `$${item.price.toFixed(2)}` : '—'}
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
    </div>
  );
}

// ✅ Token address mappings for TokenLogo
const TOKEN_ADDRESSES: Record<string, string> = {
  'ETH': '0xdac17f958d2ee523a2206206994597c13d831ec7',
  'USDC': '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  'USDT': '0xdac17f958d2ee523a2206206994597c13d831ec7',
  'WBTC': '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
  'LINK': '0x514910771af9ca656af840dff83e8264ecf986ca',
  'UNI': '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
  'MATIC': '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0',
  'BNB': '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
  'ARB': '0x912ce59144191c1204e64559fe8253a0e49e6548',
  'OP': '0x4200000000000000000000000000000000000042',
  'AVAX': '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7',
  'DAI': '0x6b175474e89094c44da98b954eedeac495271d0f',
  'SOL': '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0',
  'AAVE': '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
  'MKR': '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2',
  'CRV': '0xd533a949740bb3306d119cc777fa900ba034cd52',
  'CVX': '0x4e3fbd56cd56c3e72c1403e103b45db9da5b9d2b',
};