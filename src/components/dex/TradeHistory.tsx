// src/components/dex/TradeHistory.tsx
'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, TrendingUp, TrendingDown, Clock, Loader2 } from 'lucide-react';

interface Trade {
  id: string;
  txHash: string;
  chain: string;
  dexName: string;
  fromSymbol: string;
  fromAmount: number;
  toSymbol: string;
  toAmount: number;
  status: string;
  timestamp: string;
}

export function TradeHistory({ walletId }: { walletId: string }) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrades = async () => {
      if (!walletId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // ✅ Mock trades for testing
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // ✅ Return mock data
        setTrades([
          {
            id: '1',
            txHash: `0x${Math.random().toString(16).slice(2, 66)}`,
            chain: 'ETHEREUM',
            dexName: 'Uniswap',
            fromSymbol: 'ETH',
            fromAmount: 0.5,
            toSymbol: 'USDC',
            toAmount: 1750,
            status: 'completed',
            timestamp: new Date().toISOString(),
          },
          {
            id: '2',
            txHash: `0x${Math.random().toString(16).slice(2, 66)}`,
            chain: 'POLYGON',
            dexName: 'QuickSwap',
            fromSymbol: 'MATIC',
            fromAmount: 100,
            toSymbol: 'USDC',
            toAmount: 50,
            status: 'completed',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
          },
        ]);
      } catch (err) {
        setError('Failed to load trade history');
        setTrades([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTrades();
  }, [walletId]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>{error}</p>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No trades yet</p>
        <p className="text-xs mt-1">Swap tokens to see your trade history</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[400px] overflow-y-auto">
      {trades.map((trade) => (
        <div
          key={trade.id}
          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/30 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-full flex-shrink-0 ${
              trade.status === 'completed' 
                ? 'bg-green-50 dark:bg-green-900/20' 
                : 'bg-yellow-50 dark:bg-yellow-900/20'
            }`}>
              {trade.status === 'completed' ? (
                <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
              ) : (
                <Loader2 className="w-4 h-4 animate-spin text-yellow-600" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium truncate">
                  {trade.fromAmount} {trade.fromSymbol}
                </span>
                <span className="text-gray-400">→</span>
                <span className="font-medium truncate">
                  {trade.toAmount} {trade.toSymbol}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                <span>{trade.dexName}</span>
                <span>•</span>
                <span>{trade.chain}</span>
                <span>•</span>
                <span className={trade.status === 'completed' ? 'text-green-600 dark:text-green-400' : 'text-yellow-600'}>
                  {trade.status}
                </span>
                <span>•</span>
                <span>{new Date(trade.timestamp).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          <a
            href={`https://etherscan.io/tx/${trade.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
          >
            <ExternalLink className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </a>
        </div>
      ))}
    </div>
  );
}