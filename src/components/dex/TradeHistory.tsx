// src/components/dex/TradeHistory.tsx
'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, TrendingUp, TrendingDown, Clock } from 'lucide-react';

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

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const response = await fetch(`/api/dex/history?walletId=${walletId}`);
        const result = await response.json();
        if (result.success) {
          setTrades(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch trades:', error);
      } finally {
        setLoading(false);
      }
    };

    if (walletId) {
      fetchTrades();
    }
  }, [walletId]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No trades yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {trades.map((trade) => (
        <div
          key={trade.id}
          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-full">
              {trade.status === 'completed' ? (
                <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
              ) : (
                <Loader2 className="w-4 h-4 animate-spin text-yellow-600" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {trade.fromAmount} {trade.fromSymbol}
                </span>
                <span className="text-gray-400">→</span>
                <span className="font-medium">
                  {trade.toAmount} {trade.toSymbol}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span>{trade.dexName}</span>
                <span>•</span>
                <span>{trade.chain}</span>
                <span>•</span>
                <span className={trade.status === 'completed' ? 'text-green-600 dark:text-green-400' : 'text-yellow-600'}>
                  {trade.status}
                </span>
              </div>
            </div>
          </div>
          <a
            href={`https://etherscan.io/tx/${trade.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ExternalLink className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </a>
        </div>
      ))}
    </div>
  );
}