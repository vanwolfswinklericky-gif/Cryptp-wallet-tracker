'use client';

import { useState, useEffect } from 'react';
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
  tokens?: { symbol: string; address: string; name: string }[];
}

// ✅ Known scam token symbols to filter out
const SCAM_SYMBOLS = [
  'BLINK', 'WWW.SOFTCRYPT.COM', 'MATKA', 'CATE', 'HUB', 'SOBA', 
  'VITALIK', '0XWORMHOLE', 'NEIRO2.0', 'SOFTCRYPT', 'CATE.LIFE',
  'CLAIM', 'REWARD', 'AIRDROP', 'BONUS', 'FREE', 'T.ME', 'TELEGRAM'
];

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
};

// ✅ Check if a symbol is a scam token
const isScamToken = (symbol: string): boolean => {
  const upperSymbol = symbol.toUpperCase();
  return SCAM_SYMBOLS.some(scam => upperSymbol.includes(scam) || scam.includes(upperSymbol));
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

  const fetchLivePrices = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setApiFailed(false);

    try {
      // ✅ Default symbols if no tokens provided
      let symbols: string[] = ['ETH', 'USDC', 'WBTC', 'LINK', 'UNI', 'MATIC', 'BNB'];
      
      if (tokens && tokens.length > 0) {
        // ✅ Extract symbols from tokens (handles both symbol and tokenSymbol)
        const tokenSymbols = tokens
          .map(t => (t.symbol || (t as any).tokenSymbol)?.toUpperCase())
          .filter(Boolean) as string[];
        
        // ✅ Filter out scam tokens
        const cleanSymbols = tokenSymbols.filter(s => !isScamToken(s));
        
        if (cleanSymbols.length > 0) {
          symbols = cleanSymbols.slice(0, 10);
          console.log('🔍 LivePrices using clean token symbols:', symbols);
        } else {
          console.log('ℹ️ No clean token symbols found, using defaults');
        }
      }

      // ✅ Fetch real prices from Alchemy + CoinGecko
      const priceData = await getMultipleTokenPrices(symbols);
      
      // Check if we got any valid prices
      const hasValidPrices = Object.values(priceData).some(p => p > 0);
      
      if (hasValidPrices) {
        const formattedPrices: PriceData[] = symbols.map(symbol => ({
          symbol,
          name: getTokenName(symbol),
          price: priceData[symbol] || 0,
          priceChange24h: 0,
          currency: 'USD',
        }));
        
        setPrices(formattedPrices);
        setApiFailed(false);
        console.log('✅ LivePrices updated with real prices');
      } else {
        console.warn('⚠️ No valid prices from APIs');
        setApiFailed(true);
        // Don't set fallback prices - show zeros
        setPrices(symbols.map(symbol => ({
          symbol,
          name: getTokenName(symbol),
          price: 0,
          priceChange24h: 0,
          currency: 'USD',
        })));
      }
      
      setLastUpdated(new Date());
    } catch (error) {
      console.error('❌ Failed to fetch live prices:', error);
      setApiFailed(true);
      // Only show zeros, not fallback
      const defaultSymbols = ['ETH', 'USDC', 'WBTC', 'LINK', 'UNI', 'MATIC', 'BNB'];
      setPrices(defaultSymbols.map(symbol => ({
        symbol,
        name: getTokenName(symbol),
        price: 0,
        priceChange24h: 0,
        currency: 'USD',
      })));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLivePrices();
    const interval = setInterval(fetchLivePrices, 60000);
    return () => clearInterval(interval);
  }, [tokens]);

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
      <div className="flex items-center justify-between">
        {apiFailed && (
          <span className="text-[10px] text-yellow-500 dark:text-yellow-400">
            ⚠️ Unable to fetch live prices
          </span>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {lastUpdated && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchLivePrices}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {prices.map((item) => (
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
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {item.price > 0 ? `$${item.price.toFixed(2)}` : 'Price unavailable'}
            </p>
            {item.priceChange24h !== 0 && item.price > 0 && (
              <div className={`flex items-center justify-end gap-1 text-xs font-medium ${getChangeColor(item.priceChange24h)}`}>
                {getChangeIcon(item.priceChange24h)}
                {Math.abs(item.priceChange24h).toFixed(2)}%
              </div>
            )}
          </div>
        </div>
      ))}
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