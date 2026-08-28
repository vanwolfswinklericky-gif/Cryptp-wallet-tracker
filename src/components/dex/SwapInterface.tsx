// src/components/dex/SwapInterface.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  ArrowUpDown,
  Loader2,
  RefreshCw,
  AlertCircle,
  Check,
  X,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';

interface Token {
  address: string;
  symbol: string;
  name: string;
  balance: number;
  price: number;
  logo?: string;
}

interface SwapQuote {
  fromToken: string;
  toToken: string;
  fromAmount: number;
  toAmount: number;
  priceImpact: number;
  route: string[];
  dex: string;
  gasEstimate: number;
  slippage: number;
}

export function SwapInterface({ walletId }: { walletId: string }) {
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [fromToken, setFromToken] = useState<Token | null>(null);
  const [toToken, setToToken] = useState<Token | null>(null);
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slippage, setSlippage] = useState(0.5);
  const [chain, setChain] = useState('ETHEREUM');
  const [tradeStatus, setTradeStatus] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const debouncedFromAmount = useDebounce(fromAmount, 500);

  // Mock tokens (replace with actual token list)
  const tokens: Token[] = [
    { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', name: 'Wrapped Ether', balance: 1.5, price: 3500 },
    { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', name: 'USD Coin', balance: 5000, price: 1 },
    { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', name: 'Tether', balance: 3000, price: 1 },
    { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC', name: 'Wrapped Bitcoin', balance: 0.05, price: 65000 },
  ];

  // Get quote when amount changes
  useEffect(() => {
    if (debouncedFromAmount && fromToken && toToken && parseFloat(debouncedFromAmount) > 0) {
      fetchQuote();
    }
  }, [debouncedFromAmount, fromToken, toToken]);

  const fetchQuote = async () => {
    if (!fromToken || !toToken || !parseFloat(fromAmount)) {
      setQuote(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/dex/quote?chain=${chain}&fromToken=${fromToken.address}&toToken=${toToken.address}&amount=${fromAmount}&slippage=${slippage}`
      );

      const result = await response.json();

      if (result.success) {
        setQuote(result.data);
        setToAmount(result.data.toAmount.toFixed(6));
      } else {
        setError(result.error || 'Failed to get quote');
        setQuote(null);
      }
    } catch (err) {
      setError('Network error');
      setQuote(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = async () => {
    if (!quote || !walletId || !fromToken || !toToken) return;

    setSwapping(true);
    setError(null);
    setTradeStatus('Initiating swap...');

    try {
      const response = await fetch('/api/dex/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId,
          chain,
          fromToken: fromToken.address,
          toToken: toToken.address,
          fromAmount: parseFloat(fromAmount),
          toAmount: quote.toAmount,
          dex: quote.dex,
          slippage,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setTradeStatus('Swap completed!');
        setTxHash(result.data.txHash);
        setFromAmount('');
        setToAmount('');
        setQuote(null);
      } else {
        setError(result.error || 'Swap failed');
        setTradeStatus('Swap failed');
      }
    } catch (err) {
      setError('Swap failed');
      setTradeStatus('Swap failed');
    } finally {
      setSwapping(false);
    }
  };

  const handleReverseTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount('');
    setToAmount('');
    setQuote(null);
  };

  return (
    <div className="space-y-4">
      {/* Chain Selector */}
      <div className="flex items-center gap-2">
        <select
          value={chain}
          onChange={(e) => setChain(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="ETHEREUM">Ethereum</option>
          <option value="POLYGON">Polygon</option>
          <option value="BSC">BSC</option>
          <option value="ARBITRUM">Arbitrum</option>
        </select>
      </div>

      {/* From Token */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">From</span>
          <button className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
            Max
          </button>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={fromAmount}
            onChange={(e) => {
              setFromAmount(e.target.value);
              setToAmount('');
            }}
            placeholder="0.0"
            className="flex-1 bg-transparent text-2xl font-semibold outline-none placeholder:text-gray-400"
          />
          <select
            value={fromToken?.address || ''}
            onChange={(e) => {
              const token = tokens.find((t) => t.address === e.target.value);
              setFromToken(token || null);
            }}
            className="px-3 py-2 bg-white dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium"
          >
            <option value="">Select token</option>
            {tokens.map((token) => (
              <option key={token.address} value={token.address}>
                {token.symbol}
              </option>
            ))}
          </select>
        </div>
        {fromToken && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Balance: {fromToken.balance.toFixed(4)}
          </div>
        )}
      </div>

      {/* Swap Arrow */}
      <div className="flex justify-center">
        <button
          onClick={handleReverseTokens}
          className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <ArrowUpDown className="w-5 h-5" />
        </button>
      </div>

      {/* To Token */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">To</span>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={toAmount}
            readOnly
            placeholder="0.0"
            className="flex-1 bg-transparent text-2xl font-semibold outline-none placeholder:text-gray-400"
          />
          <select
            value={toToken?.address || ''}
            onChange={(e) => {
              const token = tokens.find((t) => t.address === e.target.value);
              setToToken(token || null);
            }}
            className="px-3 py-2 bg-white dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium"
          >
            <option value="">Select token</option>
            {tokens.map((token) => (
              <option key={token.address} value={token.address}>
                {token.symbol}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Quote Details */}
      {quote && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 space-y-2 text-sm border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Rate</span>
            <span className="font-medium">
              1 {fromToken?.symbol} = {(quote.toAmount / quote.fromAmount).toFixed(6)} {toToken?.symbol}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Price Impact</span>
            <span className={quote.priceImpact < 1 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}>
              {quote.priceImpact.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">DEX</span>
            <span className="font-medium">{quote.dex}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Gas Estimate</span>
            <span className="font-medium">~{quote.gasEstimate.toFixed(0)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500 dark:text-gray-400">Slippage</span>
            <input
              type="number"
              value={slippage}
              onChange={(e) => setSlippage(parseFloat(e.target.value) || 0.5)}
              className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-right"
              step="0.1"
              min="0.1"
              max="5"
            />
            <span className="text-sm">%</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Trade Status */}
      {tradeStatus && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm">
          {swapping ? <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" /> : <Check className="w-4 h-4 flex-shrink-0" />}
          {tradeStatus}
        </div>
      )}

      {/* Tx Hash */}
      {txHash && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm">
          <p className="text-green-600 dark:text-green-400">Transaction submitted</p>
          <a
            href={`https://etherscan.io/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline text-xs"
          >
            View on Etherscan
          </a>
        </div>
      )}

      {/* Swap Button */}
      <button
        onClick={handleSwap}
        disabled={!quote || swapping || !fromToken || !toToken}
        className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
      >
        {swapping ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Swapping...
          </>
        ) : !fromToken || !toToken ? (
          'Select tokens'
        ) : !fromAmount || parseFloat(fromAmount) <= 0 ? (
          'Enter amount'
        ) : !quote ? (
          'Get quote'
        ) : (
          `Swap ${fromToken?.symbol} → ${toToken?.symbol}`
        )}
      </button>
    </div>
  );
}