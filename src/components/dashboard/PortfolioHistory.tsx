// src/components/dashboard/PortfolioHistory.tsx
'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import PortfolioChart from '@/components/PortfolioChart';

interface HistoryPoint {
  date: string;
  value: number;
  change: number;
  changePercentage: number;
}

interface Props {
  address: string;
  chain?: string;
}

export default function PortfolioHistory({ address, chain = 'ethereum' }: Props) {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  useEffect(() => {
    const fetchHistory = async () => {
      if (!address) return;
      
      setLoading(true);
      setError(null);

      try {
        const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
        const response = await fetch(
          `/api/v1/portfolio/history?address=${address}&chain=${chain}&days=${days}`
        );

        if (!response.ok) throw new Error('Failed to fetch history');

        const data = await response.json();
        setHistory(data.data?.history || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [address, chain, period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500 dark:text-red-400">
        {error}
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No historical data available
      </div>
    );
  }

  const chartData = history.map(point => ({
    date: new Date(point.date).toLocaleDateString(),
    value: point.value,
  }));

  const startValue = history[0]?.value || 0;
  const endValue = history[history.length - 1]?.value || 0;
  const totalChange = endValue - startValue;
  const totalChangePercentage = startValue > 0 ? (totalChange / startValue) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Portfolio Value
          </span>
        </div>
        <div className="flex gap-1">
          {(['7d', '30d', '90d', '1y'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                period === p
                  ? 'bg-blue-600 text-white dark:bg-blue-500'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64">
        <PortfolioChart data={chartData} isLoading={false} />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">Start Value</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            ${startValue.toFixed(2)}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">End Value</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            ${endValue.toFixed(2)}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">Change</p>
          <div className="flex items-center gap-1">
            <span className={`text-lg font-semibold ${
              totalChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}>
              ${totalChange.toFixed(2)}
            </span>
            {totalChange >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
            )}
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">Change %</p>
          <p className={`text-lg font-semibold ${
            totalChangePercentage >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {totalChangePercentage >= 0 ? '+' : ''}{totalChangePercentage.toFixed(2)}%
          </p>
        </div>
      </div>
    </div>
  );
}