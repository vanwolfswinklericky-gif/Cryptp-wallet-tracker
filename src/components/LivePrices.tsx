'use client';

import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import TokenLogo from './TokenLogo';

interface Props {
  chain?: string;
  tokens?: any[];
}

// ✅ Curated list of featured tokens shown in the sidebar
const FEATURED_TOKENS = [
  { symbol: 'ETH',  address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', name: 'Ethereum' },
  { symbol: 'USDC', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', name: 'USD Coin' },
  { symbol: 'USDT', address: '0xdac17f958d2ee523a2206206994597c13d831ec7', name: 'Tether' },
  { symbol: 'WBTC', address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', name: 'Wrapped Bitcoin' },
  { symbol: 'LINK', address: '0x514910771af9ca656af840dff83e8264ecf986ca', name: 'Chainlink' },
  { symbol: 'UNI',  address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', name: 'Uniswap' },
  { symbol: 'MATIC',address: '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0', name: 'Polygon' },
  { symbol: 'AAVE', address: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9', name: 'Aave' },
  { symbol: 'DAI',  address: '0x6b175474e89094c44da98b954eedeac495271d0f', name: 'Dai' },
  { symbol: 'GEL',  address: '0x15b7c0c907e4c6b9adaaaabc300c08991d6cea05', name: 'Gelato Network' },
];

export default function LivePrices({ chain = 'ethereum', tokens = [] }: Props) {
  // ✅ Match featured tokens against the wallet's holdings
  // Zerion already provides valueUsd for each — no /api/prices call needed
  const tokenMap = new Map(
    tokens.map((t) => {
      const address = (t.contractAddress || t.tokenAddress || '').toLowerCase();
      return [address, t];
    })
  );

  const displayTokens = FEATURED_TOKENS
    .map((featured) => {
      const holding = tokenMap.get(featured.address.toLowerCase());
      if (!holding) return null;

      // ✅ Prefer Zerion's formatted balance
      const balance = holding.formatted
        ? parseFloat(holding.formatted)
        : parseFloat(holding.balance || '0') / Math.pow(10, holding.decimals || 18);

      const valueUsd = holding.valueUsd || 0;

      // ✅ Compute price from Zerion's valueUsd
      const price = balance > 0 ? valueUsd / balance : 0;

      return {
        symbol: featured.symbol,
        name: featured.name,
        address: featured.address,
        price: isNaN(price) ? 0 : price,
        valueUsd,
        balance,
        priceChange24h: 0, // Zerion positions don't include 24h change
      };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null && t.balance > 0);

  const totalFeaturedValue = displayTokens.reduce((sum, t) => sum + t.valueUsd, 0);

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

  const formatBalance = (balance: number) => {
    if (balance === 0) return '0';
    if (balance > 1e6) return (balance / 1e6).toFixed(2) + 'M';
    if (balance > 1000) return balance.toFixed(2);
    if (balance > 1) return balance.toFixed(4);
    return balance.toFixed(6);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-emerald-900/30">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {displayTokens.length} token{displayTokens.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {totalFeaturedValue > 0 && (
            <span className="text-[10px] text-emerald-100/60">
              ${totalFeaturedValue.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      {/* Price list */}
      {displayTokens.map((item) => {
        const hasPrice = item.price > 0;

        return (
          <div
            key={item.symbol}
            className="flex items-center justify-between p-2 rounded-xl transition-colors hover:bg-emerald-500/5"
          >
            <div className="flex items-center gap-3">
              <TokenLogo
                chain={chain}
                address={item.address}
                symbol={item.symbol}
                size={32}
              />
              <div>
                <p className="text-sm font-semibold text-white">{item.symbol}</p>
                <p className="text-xs text-emerald-100/50">
                  {formatBalance(item.balance)} {item.symbol}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-sm font-semibold ${hasPrice ? 'text-white' : 'text-emerald-100/30'}`}>
                {formatPrice(item.price)}
              </p>
              {item.valueUsd > 0 && (
                <p className="text-xs text-emerald-100/50">
                  ${item.valueUsd.toFixed(2)}
                </p>
              )}
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

      {displayTokens.length === 0 && (
        <div className="text-center text-xs text-emerald-100/40 py-6">
          No featured tokens in this wallet
        </div>
      )}
    </div>
  );
}