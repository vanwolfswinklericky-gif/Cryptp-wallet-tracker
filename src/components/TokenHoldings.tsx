'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, Loader2, Shield, ExternalLink } from 'lucide-react';
import TokenLogo from './TokenLogo';
import { getMultipleTokenPrices } from '@/lib/prices';

interface Token {
  contractAddress: string;
  tokenName: string;
  tokenSymbol: string;
  decimals: number;
  balance: string | number;
}

interface Props {
  tokens: Token[];
  chain: string;
  isLoading?: boolean;
}

export default function TokenHoldings({ tokens, chain, isLoading = false }: Props) {
  const [tokensWithPrices, setTokensWithPrices] = useState<any[]>([]);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [showScamWarning, setShowScamWarning] = useState(false);

  // ✅ Parse token balance that handles hex strings (0x...)
  const parseTokenBalance = (balance: string | number, decimals: number): number => {
    if (balance === null || balance === undefined) return 0;

    try {
      if (typeof balance === 'string' && balance.startsWith('0x')) {
        const big = BigInt(balance);
        return Number(big) / Math.pow(10, decimals || 18);
      }

      const balanceNum = typeof balance === 'string' ? parseFloat(balance) : balance;
      if (isNaN(balanceNum)) return 0;

      return balanceNum / Math.pow(10, decimals || 18);
    } catch {
      return 0;
    }
  };

  // ✅ Check if token is a known scam pattern (applies to ALL tokens, not just zero-balance)
  const isKnownScamToken = (token: Token): boolean => {
    const name = (token.tokenName || '').toLowerCase();
    const symbol = (token.tokenSymbol || '').toLowerCase();
    
    // ⚠️ Critical: Phishing links in token names - ALWAYS scam
    const scamPatterns = [
      // Phishing URLs
      'fli.so', 't.ly', 'claim', 'reward', 'airdrop', 'bonus', 'free',
      't.me', 'telegram', 'visit', 'pool', 'stake', 'vault',
      'promo', 'giveaway', 'win', 'prize', 'claim now',
      // Known scam tokens
      'shib', 'nft', 'paws', 'dydx', 'voucher',
      // Suspicious patterns
      '.com', '.org', '.net', '.io', '.link',
      'http://', 'https://', 'www.',
      // Impersonation
      'steth', 'wbtc', 'usdc', 'usdt', 'dai',
    ];
    
    // ✅ Check for scam patterns in name OR symbol (regardless of balance)
    const hasScamPattern = scamPatterns.some(pattern => 
      name.includes(pattern) || symbol.includes(pattern)
    );
    
    // ✅ Also check for suspicious characteristics
    const hasPhishingLink = name.includes('.') || name.includes('/') || name.includes('http');
    const hasSuspiciousFormat = /[\[\]\(\)\{\}]/.test(name) || /[\/\\]/.test(name);
    const isAllCaps = symbol === symbol.toUpperCase() && symbol.length > 5 && !symbol.includes(' ');
    
    return hasScamPattern || hasPhishingLink || hasSuspiciousFormat || isAllCaps;
  };

  // ✅ Check if token is likely real (has a price or is a known legitimate token)
  const isLikelyRealToken = (token: Token): boolean => {
    const symbol = (token.tokenSymbol || '').toUpperCase();
    
    // Known legitimate tokens (whitelist)
    const knownRealTokens = [
      'ETH', 'USDC', 'USDT', 'WBTC', 'LINK', 'UNI', 'MATIC', 'BNB', 
      'ARB', 'OP', 'AVAX', 'DAI', 'AAVE', 'MKR', 'CRV', 'CVX', 
      'SOL', 'BTC', 'XRP', 'ADA', 'DOT', 'ATOM'
    ];
    
    if (knownRealTokens.includes(symbol)) {
      return true;
    }
    
    // If it has a balance AND doesn't have scam patterns, it might be real
    const balance = parseTokenBalance(token.balance, token.decimals);
    return balance > 0.0001 && !isKnownScamToken(token);
  };

  // ✅ Enhanced spam filter - checks ALL tokens regardless of balance
  const isSpamToken = (token: Token): boolean => {
    // First, check if it's a known scam pattern
    if (isKnownScamToken(token)) {
      console.log('🔍 Filtered scam token:', token.tokenSymbol, token.tokenName);
      return true;
    }
    
    // Check if it's likely real (has price or is whitelisted)
    if (isLikelyRealToken(token)) {
      return false; // Keep it
    }
    
    // For unknown tokens: if balance is 0 or extremely tiny, filter it
    const balance = parseTokenBalance(token.balance, token.decimals);
    if (balance === 0) {
      console.log('🔍 Filtered zero-balance token:', token.tokenSymbol);
      return true;
    }
    
    // For tokens with balance but no price and suspicious name, filter
    if (balance < 0.0001 && token.tokenName && token.tokenName.length < 3) {
      console.log('🔍 Filtered suspicious token:', token.tokenSymbol);
      return true;
    }
    
    // Keep tokens with balance > 0.0001
    return false;
  };

  // ✅ Filter tokens
  const cleanTokens = tokens.filter(t => !isSpamToken(t));

  // ✅ Keep only tokens with actual balance
  const finalTokens = cleanTokens.filter(t => {
    const actualBalance = parseTokenBalance(t.balance, t.decimals);
    return actualBalance > 0;
  });

  // ✅ Count scam tokens for warning
  const scamCount = tokens.length - cleanTokens.length;

  useEffect(() => {
    const fetchTokenPrices = async () => {
      if (!finalTokens || finalTokens.length === 0) return;
      
      setLoadingPrices(true);
      
      try {
        const symbols = [...new Set(finalTokens.map(t => t.tokenSymbol?.toUpperCase()).filter(Boolean))];
        
        if (symbols.length === 0) {
          setLoadingPrices(false);
          return;
        }

        const priceData = await getMultipleTokenPrices(symbols);
        
        const updatedTokens = finalTokens.map((token) => {
          const symbol = token.tokenSymbol?.toUpperCase() || '';
          const price = priceData[symbol] || 0;
          const actualBalance = parseTokenBalance(token.balance, token.decimals);
          
          return {
            ...token,
            price,
            value: price * actualBalance,
            balanceFormatted: actualBalance,
          };
        });
        
        setTokensWithPrices(updatedTokens);
      } catch (error) {
        console.error('Failed to fetch token prices:', error);
        setTokensWithPrices(finalTokens.map(t => ({
          ...t,
          price: 0,
          value: 0,
          balanceFormatted: parseTokenBalance(t.balance, t.decimals),
        })));
      } finally {
        setLoadingPrices(false);
      }
    };

    fetchTokenPrices();
  }, [tokens]);

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

  if (!finalTokens || finalTokens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Shield className="h-8 w-8 text-green-500 dark:text-green-400 mb-3" />
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {tokens.length > 0 && scamCount > 0 
            ? `${scamCount} scam tokens filtered` 
            : 'No valid tokens found'}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm">
          {tokens.length > 0 && scamCount > 0 
            ? 'Your wallet has been protected from phishing tokens' 
            : 'This wallet does not hold any legitimate tokens'}
        </p>
        {tokens.length > 0 && scamCount > 0 && (
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
            <Shield className="h-3 w-3" />
            Scam tokens filtered: {scamCount}
          </p>
        )}
      </div>
    );
  }

  const formatBalance = (value: number): string => {
    if (value === 0) return '0.00';
    if (value > 1000) return value.toFixed(2);
    if (value > 1) return value.toFixed(4);
    return value.toFixed(6);
  };

  const totalValue = tokensWithPrices.reduce((sum, t) => sum + (t.value || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500 dark:text-gray-400">
          {finalTokens.length} asset{finalTokens.length === 1 ? '' : 's'}
        </span>
        <div className="flex items-center gap-3">
          {scamCount > 0 && (
            <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <Shield className="h-3 w-3" />
              {scamCount} scam tokens blocked
            </span>
          )}
          {totalValue > 0 && (
            <span className="text-sm font-medium text-green-600 dark:text-green-400">
              ${totalValue.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      {tokensWithPrices.slice(0, 10).map((token, index) => {
        const usdValue = token.value || 0;
        
        return (
          <div
            key={index}
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
                {formatBalance(token.balanceFormatted || 0)}
              </p>
              {loadingPrices ? (
                <Loader2 className="h-3 w-3 animate-spin text-gray-400 ml-auto" />
              ) : usdValue > 0.01 ? (
                <p className="text-xs text-green-600 dark:text-green-400">
                  ${usdValue.toFixed(2)}
                </p>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {usdValue > 0 ? `$${usdValue.toFixed(4)}` : 'Price unavailable'}
                </p>
              )}
            </div>
          </div>
        );
      })}
      
      {finalTokens.length > 10 && (
        <p className="text-xs text-center text-gray-400 dark:text-gray-500">
          + {finalTokens.length - 10} more tokens
        </p>
      )}
    </div>
  );
}