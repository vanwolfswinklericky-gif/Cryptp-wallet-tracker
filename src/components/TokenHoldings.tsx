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

// ✅ WHITELIST: Real tokens that should NEVER be filtered
const LEGITIMATE_TOKENS = new Set([
  // Majors
  'ETH', 'BTC', 'BNB', 'MATIC', 'AVAX', 'SOL', 'XRP', 'ADA', 'DOT', 'ATOM',
  'LTC', 'BCH', 'NEAR', 'ALGO', 'FTM', 'ONE',
  // Wrapped
  'WETH', 'WBTC', 'WMATIC', 'WBNB', 'WAVAX',
  // Stablecoins
  'USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'USDP', 'GUSD',
  // DeFi
  'LINK', 'UNI', 'AAVE', 'MKR', 'CRV', 'CVX', 'COMP', 'SNX',
  'BAT', 'MANA', 'SAND', 'APE', 'GRT', '1INCH', 'SUSHI',
  // L2
  'ARB', 'OP', 'IMX', 'BOBA',
  // Meme (real ones)
  'SHIB', 'DOGE', 'PEPE', 'FLOKI', 'BONK', 'WIF',
  // Other
  'GEL', 'YRISE', 'INDEX', 'MULTI', 'PICKLE',
]);

export default function TokenHoldings({ tokens, chain, isLoading = false }: Props) {
  const [tokensWithPrices, setTokensWithPrices] = useState<any[]>([]);
  const [loadingPrices, setLoadingPrices] = useState(false);

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

  // ✅ PRECISE scam detection — only obvious spam
  const isKnownScamToken = (token: Token): boolean => {
    const name = (token.tokenName || '').toLowerCase();
    const symbol = (token.tokenSymbol || '').toUpperCase();
    
    // ✅ Whitelist always passes
    if (LEGITIMATE_TOKENS.has(symbol)) return false;
    
    // ✅ Clear phishing URLs (only in name)
    const hasUrl = /https?:\/\//.test(name) || /www\./.test(name) || 
                   /\.com/.test(name) || /\.io/.test(name) || 
                   /\.life/.test(name) || /\.today/.test(name) || 
                   /t\.me\//.test(name) || /fli\.so/.test(name);
    
    // ✅ Clear phishing phrases
    const hasPhishingPhrase = 
      /claim.*reward/i.test(name) ||
      /visit.*claim/i.test(name) ||
      /claim.*now/i.test(name) ||
      /free.*token/i.test(name) ||
      /claim.*airdrop/i.test(name);
    
    // ✅ Suspicious brackets in name
    const hasBrackets = /[\[\]\(\)\{\}]/.test(token.tokenName || '');
    
    // ✅ Extremely long name/symbol (spam characteristic)
    const isExtremelyLong = name.length > 100 || symbol.length > 30;
    
    return hasUrl || hasPhishingPhrase || hasBrackets || isExtremelyLong;
  };

  const isLikelyRealToken = (token: Token): boolean => {
    const symbol = (token.tokenSymbol || '').toUpperCase();
    
    // Whitelist match = real
    if (LEGITIMATE_TOKENS.has(symbol)) return true;
    
    // Has balance + no scam markers = probably real
    const balance = parseTokenBalance(token.balance, token.decimals);
    if (balance <= 0) return false;
    
    // If it doesn't have obvious scam markers, keep it
    return !isKnownScamToken(token);
  };

  const isSpamToken = (token: Token): boolean => {
    // ✅ Real tokens always pass
    if (isLikelyRealToken(token)) return false;
    
    // ✅ Known scam tokens filtered
    if (isKnownScamToken(token)) {
      console.log('🚫 Filtered scam:', token.tokenSymbol, '-', token.tokenName);
      return true;
    }
    
    // ✅ Zero-balance tokens filtered
    const balance = parseTokenBalance(token.balance, token.decimals);
    if (balance === 0) return true;
    
    // ✅ Everything else: keep it
    return false;
  };

  const cleanTokens = tokens.filter(t => !isSpamToken(t));

  const finalTokens = cleanTokens.filter(t => {
    const actualBalance = parseTokenBalance(t.balance, t.decimals);
    return actualBalance > 0;
  });

  const scamCount = tokens.length - cleanTokens.length;

  useEffect(() => {
    const fetchTokenPrices = async () => {
      if (!finalTokens || finalTokens.length === 0) {
        setTokensWithPrices([]);
        return;
      }
      
      setLoadingPrices(true);
      
      try {
        const addresses = finalTokens
          .map(t => t.contractAddress)
          .filter(Boolean);
        
        if (addresses.length === 0) {
          setLoadingPrices(false);
          return;
        }

        // ✅ Use /api/prices with addresses
        const response = await fetch(
          `/api/prices?addresses=${addresses.join(',')}&chain=${chain}`
        );
        
        if (!response.ok) {
          throw new Error(`Prices API returned ${response.status}`);
        }
        
        const priceData: Record<string, { usd: number | string; source: string }> = 
          await response.json();
        
        const updatedTokens = finalTokens.map((token) => {
          const addr = token.contractAddress?.toLowerCase() || '';
          const priceEntry = priceData[addr];
          const rawPrice = priceEntry?.usd;
          const price = typeof rawPrice === 'string' ? parseFloat(rawPrice) :
                        typeof rawPrice === 'number' ? rawPrice : 0;
          
          const actualBalance = parseTokenBalance(token.balance, token.decimals);
          const value = isNaN(price) ? 0 : price * actualBalance;
          
          return {
            ...token,
            price: isNaN(price) ? 0 : price,
            value,
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
  }, [tokens, chain]);

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