'use client';

import { useState, useEffect } from 'react';

interface TokenLogoProps {
  chain: string;
  address: string;
  symbol?: string;
  size?: number;
  className?: string;
}

// Fallback icon sources
const ICON_SOURCES = [
  // TrustWallet CDN
  (chain: string, address: string) => {
    const chainMap: Record<string, string> = {
      ethereum: 'ethereum',
      polygon: 'polygon',
      bsc: 'binance',
      arbitrum: 'arbitrum',
      optimism: 'optimism',
      avalanche: 'avalanchec',
      base: 'base',
    };
    const chainName = chainMap[chain] || 'ethereum';
    return `https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/${chainName}/assets/${address}/logo.png`;
  },
  // CoinGecko fallback (using symbol)
  (chain: string, address: string, symbol?: string) => {
    if (!symbol) return null;
    return `https://www.coingecko.com/coins/${symbol.toLowerCase()}/thumb`;
  },
  // Etherscan fallback
  (chain: string, address: string) => {
    if (chain !== 'ethereum') return null;
    return `https://etherscan.io/token/images/${address.toLowerCase()}_32.png`;
  },
];

export default function TokenLogo({ 
  chain, 
  address, 
  symbol, 
  size = 32,
  className = '' 
}: TokenLogoProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Try to get logo from TrustWallet first
    const chainMap: Record<string, string> = {
      ethereum: 'ethereum',
      polygon: 'polygon',
      bsc: 'binance',
      arbitrum: 'arbitrum',
      optimism: 'optimism',
      avalanche: 'avalanchec',
      base: 'base',
    };
    const chainName = chainMap[chain] || 'ethereum';
    const url = `https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/${chainName}/assets/${address}/logo.png`;
    setLogoUrl(url);
  }, [chain, address]);

  if (error || !logoUrl) {
    // ✅ Show colored circle with initials as fallback
    const colors = ['#627EEA', '#2775CA', '#F5AC37', '#FF6B6B', '#6C5CE7', '#00B894', '#FD79A8', '#00CEC9'];
    const colorIndex = (symbol?.charCodeAt(0) || 0) % colors.length;
    
    return (
      <div 
        className={`flex items-center justify-center rounded-full text-white font-bold ${className}`}
        style={{ 
          width: size, 
          height: size, 
          fontSize: size * 0.4,
          backgroundColor: colors[colorIndex]
        }}
      >
        {symbol?.slice(0, 2).toUpperCase() || '??'}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={symbol || 'Token'}
      width={size}
      height={size}
      className={`rounded-full ${className}`}
      onError={() => setError(true)}
    />
  );
}