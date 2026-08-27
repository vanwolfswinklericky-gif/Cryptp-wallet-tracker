// src/components/scanner/ScannerDashboard.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Wallet,
  Coins,
  Activity,
  BarChart3,
  Loader2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Zap,
  Crown,
  Smartphone,
  Eye,
  Target,
  AlertCircle,
} from 'lucide-react';

interface WalletMetrics {
  address: string;
  chain: string;
  pnl: number;
  roi: number;
  winRate: number;
  tradeCount: number;
  averageTrade: number;
  volume: number;
  drawdown: number;
  walletScore: number;
  chains: string[];
  preferredTokens: string[];
  preferredProtocols: string[];
}

interface ScannerFilters {
  minPnL?: number;
  maxPnL?: number;
  minWinRate?: number;
  minTrades?: number;
  minPerformance?: number;
  maxDrawdown?: number;
  minWalletScore?: number;
  chains?: string[];
  tokens?: string[];
  protocols?: string[];
}

type ScannerView = 'wallets' | 'trending' | 'top-performers' | 'whales' | 'smart-money';

export default function ScannerDashboard() {
  const [view, setView] = useState<ScannerView>('wallets');
  const [wallets, setWallets] = useState<WalletMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<ScannerFilters>({
    minPnL: 20000,
    minWinRate: 60,
    minTrades: 50,
    minPerformance: 20,
    maxDrawdown: 30,
  });
  const [sortBy, setSortBy] = useState<'walletScore' | 'pnl' | 'roi' | 'winRate'>('walletScore');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchWallets = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      
      // Build query params from filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            params.append(key, value.join(','));
          } else {
            params.append(key, String(value));
          }
        }
      });

      let endpoint = '/api/scanner/wallets';
      
      if (view === 'trending') {
        endpoint = '/api/scanner/trending';
      } else if (view === 'top-performers') {
        endpoint = `/api/scanner/top-performers?timeframe=30d`;
      } else if (view === 'whales') {
        endpoint = '/api/scanner/whales';
      } else if (view === 'smart-money') {
        endpoint = '/api/scanner/smart-money';
      }

      const url = `${endpoint}${params.toString() ? `?${params.toString()}` : ''}`;
      
      console.log('🔍 Fetching scanner data:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown error');
      }
      
      setWallets(result.data.wallets || []);
    } catch (err) {
      console.error('Scanner error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load scanner data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallets();
  }, [view, filters]);

  const handleFilterChange = (key: keyof ScannerFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  const sortedWallets = [...wallets].sort((a, b) => {
    const aVal = a[sortBy] || 0;
    const bVal = b[sortBy] || 0;
    return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
  });

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getPnLColor = (pnl: number) => {
    if (pnl > 0) return 'text-green-600 dark:text-green-400';
    if (pnl < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-500 dark:text-gray-400';
  };

  const viewOptions: { value: ScannerView; label: string; icon: ReactNode }[] = [
    { value: 'wallets', label: 'All Wallets', icon: <Wallet className="w-4 h-4" /> },
    { value: 'trending', label: 'Trending', icon: <TrendingUp className="w-4 h-4" /> },
    { value: 'top-performers', label: 'Top Performers', icon: <Crown className="w-4 h-4" /> },
    { value: 'whales', label: 'Whales', icon: <Coins className="w-4 h-4" /> },
    { value: 'smart-money', label: 'Smart Money', icon: <Zap className="w-4 h-4" /> },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600 dark:text-blue-400" />
        <p className="mt-4 text-gray-600 dark:text-gray-400">Scanning wallets...</p>
        <p className="text-sm text-gray-500 dark:text-gray-500">Analyzing on-chain data</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-6 max-w-md">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-3" />
          <p className="text-center text-red-800 dark:text-red-300">{error}</p>
          <button
            onClick={fetchWallets}
            className="mt-4 w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Target className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Wallet Scanner
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Find top-performing wallets based on advanced metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            <Filter className="w-4 h-4" />
            Filters
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={fetchWallets}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <Search className="w-4 h-4" />
            Scan
          </button>
        </div>
      </div>

      {/* View Selector */}
      <div className="flex flex-wrap gap-2 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
        {viewOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => setView(option.value)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              view === option.value
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-md'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-700/50'
            }`}
          >
            {option.icon}
            {option.label}
            {option.value === 'wallets' && (
              <span className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded-full">
                {wallets.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Min PnL ($)
              </label>
              <input
                type="number"
                value={filters.minPnL || ''}
                onChange={(e) => handleFilterChange('minPnL', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                placeholder="20000"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Min Win Rate (%)
              </label>
              <input
                type="number"
                value={filters.minWinRate || ''}
                onChange={(e) => handleFilterChange('minWinRate', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                placeholder="60"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Min Trades
              </label>
              <input
                type="number"
                value={filters.minTrades || ''}
                onChange={(e) => handleFilterChange('minTrades', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                placeholder="50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Drawdown (%)
              </label>
              <input
                type="number"
                value={filters.maxDrawdown || ''}
                onChange={(e) => handleFilterChange('maxDrawdown', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                placeholder="30"
              />
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Table Header */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Wallet
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <button
                    onClick={() => setSortBy('walletScore')}
                    className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    Score
                    {sortBy === 'walletScore' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <button
                    onClick={() => setSortBy('pnl')}
                    className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    PnL
                    {sortBy === 'pnl' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <button
                    onClick={() => setSortBy('roi')}
                    className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    ROI
                    {sortBy === 'roi' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <button
                    onClick={() => setSortBy('winRate')}
                    className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    Win Rate
                    {sortBy === 'winRate' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Trades
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Drawdown
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Chain
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sortedWallets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No wallets found matching your criteria
                  </td>
                </tr>
              ) : (
                sortedWallets.map((wallet, index) => (
                  <tr
                    key={wallet.address}
                    className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                          #{index + 1}
                        </span>
                        <span className="font-mono text-xs text-gray-900 dark:text-white">
                          {formatAddress(wallet.address)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${getScoreColor(wallet.walletScore)}`}>
                        {wallet.walletScore}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${getPnLColor(wallet.pnl)}`}>
                        ${wallet.pnl.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${getPnLColor(wallet.roi)}`}>
                        {wallet.roi.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${Math.min(wallet.winRate, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{wallet.winRate.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {wallet.tradeCount}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm ${wallet.drawdown < 20 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                        {wallet.drawdown.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
                        {wallet.chain}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`https://etherscan.io/address/${wallet.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Showing {sortedWallets.length} wallets
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Last updated: {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
}