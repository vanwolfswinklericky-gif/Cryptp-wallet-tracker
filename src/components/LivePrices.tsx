'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import TokenLogo from './TokenLogo';
import { getTokenPricesFromIndexer } from '@/lib/price-indexer';

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
  'DOG': 'Dogecoin',
  'BABYASTEROID': 'Baby Asteroid',
};

// ✅ Check if a symbol is a scam token
const isScamToken = (symbol: string): boolean => {
  if (!symbol) return true;
  const upperSymbol = symbol.toUpperCase();
  return SCAM_SYMBOLS.some(scam => 
    upperSymbol.includes(scam) || scam.includes(upperSymbol)
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

  const fetchLivePrices = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setApiFailed(false);

    try {
      // ✅ Build token list from props
      let tokenList: { symbol: string; address: string }[] = [];
      
      if (tokens && tokens.length > 0) {
        // ✅ Extract symbols and addresses from tokens
        tokenList = tokens
          .map(t => {
            const symbol = (t.symbol || (t as any).tokenSymbol)?.toUpperCase() || '';
            const address = (t.address || (t as any).contractAddress) || '';
            return { symbol, address };
          })
          .filter(t => t.symbol && t.address) // Remove invalid entries
          .filter(t => !isScamToken(t.symbol)) // Filter scams
          .slice(0, 50); // Limit to 50 tokens to avoid rate limits
      }

      // ✅ If no valid tokens, use default major tokens
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
        console.log('ℹ️ No valid tokens, using default major tokens');
      }

      console.log(`🔍 Fetching prices for ${tokenList.length} tokens...`);

      // ✅ Use the PriceIndexer
      const priceData = await getTokenPricesFromIndexer(tokenList);
      
      // Count how many tokens got real prices
      const validPrices = Object.values(priceData).filter(p => p > 0).length;
      setFetchedCount(validPrices);

      // ✅ Format prices for display
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
        console.log(`✅ LivePrices updated with ${validPrices} real prices out of ${formattedPrices.length}`);
      } else {
        console.warn('⚠️ No valid prices received');
        setPrices(formattedPrices);
        setApiFailed(true);
      }
      
      setLastUpdated(new Date());
    } catch (error) {
      console.error('❌ Failed to fetch live prices:', error);
      setApiFailed(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLivePrices();
    // ✅ Refresh every 60 seconds
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

  // ✅ Loading state
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
      {/* Header with status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {apiFailed ? (
            <span className="text-[10px] text-yellow-500 dark:text-yellow-400">
              ⚠️ Limited data
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

      {/* Price list */}
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