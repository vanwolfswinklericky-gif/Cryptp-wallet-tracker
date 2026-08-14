// src/components/dashboard/PerformanceMetrics.tsx
'use client';

import { useState, useEffect } from 'react';
import { Loader2, TrendingUp, TrendingDown, DollarSign, Calendar, Activity, BarChart3 } from 'lucide-react';

interface PerformanceMetrics {
  totalValue: number;
  dayChange: number;
  dayChangePercentage: number;
  weekChange: number;
  weekChangePercentage: number;
  monthChange: number;
  monthChangePercentage: number;
  yearChange: number;
  yearChangePercentage: number;
  bestDay: { date: string; value: number };
  worstDay: { date: string; value: number };
  averageDailyChange: number;
  volatility: number;
  sharpeRatio: number;
}

interface Props {
  address: string;
  chain?: string;
  period?: '24h' | '7d' | '30d' | '90d' | '1y';
}

export default function PerformanceMetrics({ 
  address, 
  chain = 'ethereum',
  period = '30d' 
}: Props) {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'24h' | '7d' | '30d' | '90d' | '1y'>(period);

  useEffect(() => {
    const fetchPerformance = async () => {
      if (!address) return;
      
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/v1/portfolio/performance?address=${address}&chain=${chain}&period=${selectedPeriod}`
        );

        if (!response.ok) throw new Error('Failed to fetch performance metrics');

        const data = await response.json();
        setMetrics(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchPerformance();
  }, [address, chain, selectedPeriod]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
        <span className="ml-2 text-gray-500 dark:text-gray-400">Loading performance data...</span>
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

  if (!metrics) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <BarChart3 className="h-12 w-12 mx-auto mb-3 text-gray-400 dark:text-gray-500" />
        <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
          No performance data available
        </p>
      </div>
    );
  }

  const periodLabels = {
    '24h': '24 Hours',
    '7d': '7 Days',
    '30d': '30 Days',
    '90d': '90 Days',
    '1y': '1 Year',
  };

  return (
    <div className="space-y-4">
      {/* Period Selector */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-lg">
        {(['24h', '7d', '30d', '90d', '1y'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setSelectedPeriod(p)}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              selectedPeriod === p
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Value</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            ${metrics.totalValue.toFixed(2)}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">{periodLabels[selectedPeriod]} Change</p>
          <p className={`text-xl font-bold ${
            metrics.monthChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {metrics.monthChange >= 0 ? '+' : ''}{metrics.monthChangePercentage.toFixed(2)}%
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Volatility</p>
          <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
            {metrics.volatility.toFixed(2)}%
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Sharpe Ratio</p>
          <p className={`text-xl font-bold ${
            metrics.sharpeRatio >= 1 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'
          }`}>
            {metrics.sharpeRatio.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">Day Change</p>
          <p className={`text-sm font-semibold ${
            metrics.dayChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {metrics.dayChange >= 0 ? '+' : ''}{metrics.dayChangePercentage.toFixed(2)}%
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">Week Change</p>
          <p className={`text-sm font-semibold ${
            metrics.weekChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {metrics.weekChange >= 0 ? '+' : ''}{metrics.weekChangePercentage.toFixed(2)}%
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">Best Day</p>
          <p className="text-sm font-semibold text-green-600 dark:text-green-400">
            ${metrics.bestDay.value.toFixed(2)}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">Worst Day</p>
          <p className="text-sm font-semibold text-red-600 dark:text-red-400">
            ${metrics.worstDay.value.toFixed(2)}
          </p>
        </div>
      </div>

      {/* PnL Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-300">Profit & Loss Summary</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{periodLabels[selectedPeriod]} Performance</p>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-bold ${
              metrics.monthChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {metrics.monthChange >= 0 ? '+' : ''}${metrics.monthChange.toFixed(2)}
            </p>
            <p className={`text-sm font-medium ${
              metrics.monthChange >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'
            }`}>
              {metrics.monthChange >= 0 ? '▲' : '▼'} {metrics.monthChangePercentage.toFixed(2)}%
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span>Avg. Daily Change: ${metrics.averageDailyChange.toFixed(2)}</span>
          <span>•</span>
          <span>Volatility: {metrics.volatility.toFixed(2)}%</span>
        </div>
      </div>
    </div>
  );
}