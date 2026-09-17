'use client';

import { Shield, Loader2 } from 'lucide-react';
import TokenLogo from './TokenLogo';

interface Token {
  contractAddress: string;
  tokenName: string;
  tokenSymbol: string;
  decimals: number;
  balance: string | number;
  formatted?: string;
  valueUsd?: number;   // ✅ Zerion provides this
  price?: number;       // ✅ Or compute from valueUsd / balance
}

interface Props {
  tokens: Token[];
  chain: string;
  isLoading?: boolean;
}

// ✅ WHITELIST: Real tokens that should NEVER be filtered
const LEGITIMATE_TOKENS = new Set([
  'ETH', 'BTC', 'BNB', 'MATIC', 'AVAX', 'SOL', 'XRP', 'ADA', 'DOT', 'ATOM',
  'LTC', 'BCH', 'NEAR', 'ALGO', 'FTM', 'ONE',
  'WETH', 'WBTC', 'WMATIC', 'WBNB', 'WAVAX',
  'USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'USDP', 'GUSD',
  'LINK', 'UNI', 'AAVE', 'MKR', 'CRV', 'CVX', 'COMP', 'SNX',
  'BAT', 'MANA', 'SAND', 'APE', 'GRT', '1INCH', 'SUSHI',
  'ARB', 'OP', 'IMX', 'BOBA',
  'SHIB', 'DOGE', 'PEPE', 'FLOKI', 'BONK', 'WIF',
  'GEL', 'YRISE', 'INDEX', 'MULTI', 'PICKLE',
]);

export default function TokenHoldings({ tokens, chain, isLoading = false }: Props) {
  // ✅ Parse balance — handles both `formatted` (Zerion) and raw balance
  const parseTokenBalance = (token: Token): number => {
    // Prefer Zerion's pre-formatted value
    if (token.formatted) {
      const f = parseFloat(token.formatted);
      return isNaN(f) ? 0 : f;
    }

    const balance = token.balance;
    if (balance === null || balance === undefined) return 0;

    try {
      if (typeof balance === 'string' && balance.startsWith('0x')) {
        const big = BigInt(balance);
        return Number(big) / Math.pow(10, token.decimals || 18);
      }
      const num = typeof balance === 'string' ? parseFloat(balance) : balance;
      if (isNaN(num)) return 0;
      return num / Math.pow(10, token.decimals || 18);
    } catch {
      return 0;
    }
  };

  // ✅ Compute price from Zerion's valueUsd / balance
  const getTokenPrice = (token: Token, balance: number): number => {
    if (token.price !== undefined && token.price > 0) return token.price;
    if (!token.valueUsd || !balance || balance <= 0) return 0;
    return token.valueUsd / balance;
  };

  // ✅ Precise scam detection
  const isKnownScamToken = (token: Token): boolean => {
    const name = (token.tokenName || '').toLowerCase();
    const symbol = (token.tokenSymbol || '').toUpperCase();

    if (LEGITIMATE_TOKENS.has(symbol)) return false;

    const hasUrl =
      /https?:\/\//.test(name) || /www\./.test(name) ||
      /\.com/.test(name) || /\.io/.test(name) ||
      /\.life/.test(name) || /\.today/.test(name) ||
      /t\.me\//.test(name) || /fli\.so/.test(name);

    const hasPhishingPhrase =
      /claim.*reward/i.test(name) ||
      /visit.*claim/i.test(name) ||
      /claim.*now/i.test(name) ||
      /free.*token/i.test(name) ||
      /claim.*airdrop/i.test(name);

    const hasBrackets = /[\[\]\(\)\{\}]/.test(token.tokenName || '');
    const isExtremelyLong = name.length > 100 || symbol.length > 30;

    return hasUrl || hasPhishingPhrase || hasBrackets || isExtremelyLong;
  };

  const isLikelyRealToken = (token: Token): boolean => {
    const symbol = (token.tokenSymbol || '').toUpperCase();
    if (LEGITIMATE_TOKENS.has(symbol)) return true;

    const balance = parseTokenBalance(token);
    if (balance <= 0) return false;

    return !isKnownScamToken(token);
  };

  const isSpamToken = (token: Token): boolean => {
    if (isLikelyRealToken(token)) return false;
    if (isKnownScamToken(token)) return true;

    const balance = parseTokenBalance(token);
    if (balance === 0) return true;

    return false;
  };

  const cleanTokens = tokens.filter((t) => !isSpamToken(t));

  // ✅ Enrich with computed balance, price, value
  const displayTokens = cleanTokens
    .map((token) => {
      const balanceFormatted = parseTokenBalance(token);
      const price = getTokenPrice(token, balanceFormatted);
      const value = token.valueUsd && token.valueUsd > 0
        ? token.valueUsd
        : price * balanceFormatted;

      return {
        ...token,
        balanceFormatted,
        price,
        value,
      };
    })
    .filter((t) => t.balanceFormatted > 0)
    .sort((a, b) => b.value - a.value); // Sort by USD value descending

  const scamCount = tokens.length - cleanTokens.length;
  const totalValue = displayTokens.reduce((sum, t) => sum + t.value, 0);

  const formatBalance = (value: number): string => {
    if (value === 0) return '0.00';
    if (value > 1e9) return (value / 1e9).toFixed(2) + 'B';
    if (value > 1e6) return (value / 1e6).toFixed(2) + 'M';
    if (value > 1000) return value.toFixed(2);
    if (value > 1) return value.toFixed(4);
    return value.toFixed(6);
  };

  const formatPrice = (price: number): string => {
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
              <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700" />
              <div>
                <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-2 w-12 bg-gray-200 dark:bg-gray-700 rounded mt-1" />
              </div>
            </div>
            <div className="text-right">
              <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-2 w-16 bg-gray-200 dark:bg-gray-700 rounded mt-1" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (displayTokens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Shield className="h-8 w-8 text-green-500 dark:text-green-400 mb-3" />
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {tokens.length > 0 && scamCount > 0
            ? `${scamCount} scam token${scamCount === 1 ? '' : 's'} filtered`
            : 'No valid tokens found'}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm">
          {tokens.length > 0 && scamCount > 0
            ? 'Your wallet has been protected from phishing tokens'
            : 'This wallet does not hold any legitimate tokens'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm pb-2 border-b border-gray-200 dark:border-gray-700">
        <span className="text-gray-500 dark:text-gray-400">
          {displayTokens.length} asset{displayTokens.length === 1 ? '' : 's'}
        </span>
        <div className="flex items-center gap-3">
          {scamCount > 0 && (
            <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <Shield className="h-3 w-3" />
              {scamCount} blocked
            </span>
          )}
          {totalValue > 0 && (
            <span className="text-sm font-medium text-green-600 dark:text-green-400">
              ${totalValue.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      {displayTokens.slice(0, 10).map((token, index) => (
        <div
          key={`${token.contractAddress}-${index}`}
          className="flex items-center justify-between p-2 rounded-xl transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30"
        >
          <div className="flex items-center gap-3">
            <TokenLogo
              chain={chain}
              address={token.contractAddress}
              symbol={token.tokenSymbol}
              size={32}
            />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {token.tokenSymbol || 'UNKNOWN'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px]">
                {token.tokenName || 'Unknown Token'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {formatBalance(token.balanceFormatted)}
            </p>
            {token.value > 0.01 ? (
              <p className="text-xs text-green-600 dark:text-green-400">
                ${token.value.toFixed(2)}
              </p>
            ) : token.value > 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                ${token.value.toFixed(4)}
              </p>
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {token.price > 0 ? formatPrice(token.price) : 'No price'}
              </p>
            )}
          </div>
        </div>
      ))}

      {displayTokens.length > 10 && (
        <p className="text-xs text-center text-gray-400 dark:text-gray-500">
          + {displayTokens.length - 10} more tokens
        </p>
      )}
    </div>
  );
}