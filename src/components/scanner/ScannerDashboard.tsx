// src/components/scanner/ScannerDashboard.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
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
  Target,
  AlertCircle,
  Save,
  Trash2,
  Plus,
  X,
} from 'lucide-react';

interface ScannerResult {
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
  matchedFilters: string[];
}

interface ScannerFilters {
  chain?: string;
  minPnL?: number;
  maxPnL?: number;
  minWinRate?: number;
  minTrades?: number;
  minPerformance?: number;
  maxDrawdown?: number;
  minWalletScore?: number;
  preferredTokens?: string[];
  preferredProtocols?: string[];
}

interface WalletAnalytics {
  walletScore: number;
  smartMoneyScore: number;
  profitabilityScore: number;
  pnl: {
    total: number;
    byChain: Record<string, number>;
    byToken: Record<string, number>;
  };
  roi: {
    total: number;
    byChain: Record<string, number>;
  };
  drawdown: {
    max: number;
    average: number;
  };
  winRate: {
    overall: number;
    byChain: Record<string, number>;
  };
  tradingFrequency: {
    average: number;
    byDay: Record<string, number>;
  };
  consistency: {
    streak: number;
    activeDays: number;
  };
  earlyEntryBehavior: {
    score: number;
    earlyEntries: number;
    averageAdvantage: number;
  };
  accumulationBehavior: {
    score: number;
    accumulationWallets: number;
    averageHoldTime: number;
  };
  chainPreference: Record<string, number>;
  tokenPreference: string[];
  protocolPreference: string[];
}

const CHAIN_OPTIONS = ['ETHEREUM', 'POLYGON', 'BSC', 'ARBITRUM', 'OPTIMISM', 'AVALANCHE', 'BASE', 'SOLANA'];
const TOKEN_OPTIONS = ['ETH', 'USDC', 'USDT', 'WBTC', 'LINK', 'UNI', 'MATIC', 'BNB', 'ARB', 'OP', 'AVAX'];
const PROTOCOL_OPTIONS = ['Uniswap', 'Aave', 'Compound', 'Curve', 'Balancer', 'PancakeSwap', 'QuickSwap'];

export default function ScannerDashboard() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ScannerResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState<ScannerFilters>({
    chain: 'BASE',
    minPnL: 20000,
    minWinRate: 60,
    minTrades: 50,
    minPerformance: 20,
    maxDrawdown: 30,
  });
  const [sortBy, setSortBy] = useState<'walletScore' | 'pnl' | 'roi' | 'winRate'>('walletScore');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [savedCriteria, setSavedCriteria] = useState<any[]>([]);
  const [saveName, setSaveName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Analytics state
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analytics, setAnalytics] = useState<WalletAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);

  const handleScan = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/scanner/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Scan failed');
      }

      setResults(result.data.wallets || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSavedCriteria = useCallback(async () => {
    try {
      const response = await fetch('/api/scanner/scan');
      const result = await response.json();
      if (result.success) {
        setSavedCriteria(result.data || []);
      }
    } catch (err) {
      console.error('Failed to load saved criteria:', err);
    }
  }, []);

  useEffect(() => {
    loadSavedCriteria();
  }, [loadSavedCriteria]);

  // Fetch analytics for a wallet
  const fetchAnalytics = async (walletId: string) => {
    setAnalyticsLoading(true);
    setSelectedWallet(walletId);
    try {
      const response = await fetch(`/api/analytics/${walletId}`);
      const result = await response.json();
      if (result.success) {
        setAnalytics(result.data);
        setShowAnalytics(true);
      } else {
        console.error('Failed to fetch analytics:', result.error);
      }
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const sortedResults = [...results].sort((a, b) => {
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

  const handleFilterChange = (key: keyof ScannerFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value || undefined }));
  };

  const handleSaveCriteria = async () => {
    if (!saveName.trim()) return;

    try {
      const response = await fetch('/api/scanner/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...filters,
          saveAs: saveName,
          isPublic: false,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setShowSaveModal(false);
        setSaveName('');
        await loadSavedCriteria();
      }
    } catch (err) {
      console.error('Failed to save criteria:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Wallet Scanner
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Find wallets based on advanced performance criteria
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleScan}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors text-sm font-medium"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Scan
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Saved Criteria */}
      {savedCriteria.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">Saved:</span>
          {savedCriteria.map((criteria) => (
            <button
              key={criteria.id}
              onClick={() => {
                setFilters({
                  chain: criteria.chain,
                  minPnL: criteria.minPnL || undefined,
                  maxPnL: criteria.maxPnL || undefined,
                  minWinRate: criteria.minWinRate || undefined,
                  minTrades: criteria.minTrades || undefined,
                  minPerformance: criteria.minPerformance || undefined,
                  maxDrawdown: criteria.maxDrawdown || undefined,
                  minWalletScore: criteria.minWalletScore || undefined,
                  preferredTokens: criteria.preferredTokens || [],
                  preferredProtocols: criteria.preferredProtocols || [],
                });
              }}
              className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              {criteria.name}
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Chain
              </label>
              <select
                value={filters.chain || ''}
                onChange={(e) => handleFilterChange('chain', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
              >
                <option value="">All Chains</option>
                {CHAIN_OPTIONS.map(chain => (
                  <option key={chain} value={chain}>{chain}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Min PnL ($)
              </label>
              <input
                type="number"
                value={filters.minPnL || ''}
                onChange={(e) => handleFilterChange('minPnL', e.target.value ? parseFloat(e.target.value) : undefined)}
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
                onChange={(e) => handleFilterChange('minWinRate', e.target.value ? parseFloat(e.target.value) : undefined)}
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
                onChange={(e) => handleFilterChange('minTrades', e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                placeholder="50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Min 90-Day Performance (%)
              </label>
              <input
                type="number"
                value={filters.minPerformance || ''}
                onChange={(e) => handleFilterChange('minPerformance', e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                placeholder="20"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Drawdown (%)
              </label>
              <input
                type="number"
                value={filters.maxDrawdown || ''}
                onChange={(e) => handleFilterChange('maxDrawdown', e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                placeholder="30"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Min Wallet Score
              </label>
              <input
                type="number"
                value={filters.minWalletScore || ''}
                onChange={(e) => handleFilterChange('minWalletScore', e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                placeholder="80"
              />
            </div>
          </div>

          {/* Advanced Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Preferred Tokens
              </label>
              <div className="flex flex-wrap gap-1">
                {TOKEN_OPTIONS.slice(0, 6).map((token) => (
                  <button
                    key={token}
                    onClick={() => {
                      const current = filters.preferredTokens || [];
                      const updated = current.includes(token)
                        ? current.filter(t => t !== token)
                        : [...current, token];
                      handleFilterChange('preferredTokens', updated.length > 0 ? updated : undefined);
                    }}
                    className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                      (filters.preferredTokens || []).includes(token)
                        ? 'bg-blue-600 text-white dark:bg-blue-500'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {token}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Preferred Protocols
              </label>
              <div className="flex flex-wrap gap-1">
                {PROTOCOL_OPTIONS.slice(0, 6).map((protocol) => (
                  <button
                    key={protocol}
                    onClick={() => {
                      const current = filters.preferredProtocols || [];
                      const updated = current.includes(protocol)
                        ? current.filter(p => p !== protocol)
                        : [...current, protocol];
                      handleFilterChange('preferredProtocols', updated.length > 0 ? updated : undefined);
                    }}
                    className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                      (filters.preferredProtocols || []).includes(protocol)
                        ? 'bg-blue-600 text-white dark:bg-blue-500'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {protocol}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Save Criteria */}
          <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Save as..."
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
            />
            <button
              onClick={handleSaveCriteria}
              disabled={!saveName.trim()}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Table Header */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Wallet</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <button onClick={() => setSortBy('walletScore')} className="flex items-center gap-1 hover:text-gray-700">
                    Score {sortBy === 'walletScore' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <button onClick={() => setSortBy('pnl')} className="flex items-center gap-1 hover:text-gray-700">
                    PnL {sortBy === 'pnl' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <button onClick={() => setSortBy('roi')} className="flex items-center gap-1 hover:text-gray-700">
                    ROI {sortBy === 'roi' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <button onClick={() => setSortBy('winRate')} className="flex items-center gap-1 hover:text-gray-700">
                    Win Rate {sortBy === 'winRate' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Trades</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Chain</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Scanning wallets...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-red-500">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                    {error}
                  </td>
                </tr>
              ) : sortedResults.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No wallets found matching your criteria</p>
                    <p className="text-xs mt-1">Adjust your filters and try again</p>
                  </td>
                </tr>
              ) : (
                sortedResults.map((wallet, index) => (
                  <tr key={wallet.address} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500">{index + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                          {wallet.address.slice(2, 4).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-mono text-xs">{formatAddress(wallet.address)}</div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {wallet.matchedFilters.slice(0, 2).map((filter, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                                {filter}
                              </span>
                            ))}
                            {wallet.matchedFilters.length > 2 && (
                              <span className="text-[10px] text-gray-400">+{wallet.matchedFilters.length - 2}</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {wallet.preferredTokens.slice(0, 2).map((token, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                                {token}
                              </span>
                            ))}
                          </div>
                        </div>
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
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(wallet.winRate, 100)}%` }} />
                        </div>
                        <span className="text-sm font-medium">{wallet.winRate.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{wallet.tradeCount}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
                        {wallet.chain}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => fetchAnalytics(wallet.address)}
                          disabled={analyticsLoading && selectedWallet === wallet.address}
                          className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 transition-colors text-xs font-medium px-2 py-1 bg-purple-100 dark:bg-purple-900/30 rounded-lg"
                        >
                          {analyticsLoading && selectedWallet === wallet.address ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            'Analytics'
                          )}
                        </button>
                        <a
                          href={`https://etherscan.io/address/${wallet.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
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
            Showing {sortedResults.length} wallets
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Last updated: {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Analytics Modal */}
      {showAnalytics && analytics && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Wallet Analytics
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                  {selectedWallet ? formatAddress(selectedWallet) : ''}
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowAnalytics(false);
                  setAnalytics(null);
                  setSelectedWallet(null);
                }} 
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            
            {/* Scores */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">Wallet Score</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {Math.round(analytics.walletScore)}
                </p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">Smart Money</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {Math.round(analytics.smartMoneyScore)}
                </p>
              </div>
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">Win Rate</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {analytics.winRate.overall.toFixed(1)}%
                </p>
              </div>
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">Profitability</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {Math.round(analytics.profitabilityScore)}
                </p>
              </div>
            </div>
            
            {/* Performance */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total PnL</p>
                <p className={`text-xl font-bold ${analytics.pnl.total >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  ${analytics.pnl.total.toLocaleString()}
                </p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">ROI</p>
                <p className={`text-xl font-bold ${analytics.roi.total >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {analytics.roi.total.toFixed(2)}%
                </p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">Max Drawdown</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400">
                  {analytics.drawdown.max.toFixed(2)}%
                </p>
              </div>
            </div>
            
            {/* Behavior */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">Trades</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {analytics.tradingFrequency.average.toFixed(1)}/day
                </p>
                <p className="text-xs text-gray-400">{analytics.consistency.streak} month streak</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">Early Entry</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {Math.round(analytics.earlyEntryBehavior.score)}
                </p>
                <p className="text-xs text-gray-400">{analytics.earlyEntryBehavior.earlyEntries} early entries</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">Accumulation</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {Math.round(analytics.accumulationBehavior.score)}
                </p>
                <p className="text-xs text-gray-400">{analytics.accumulationBehavior.accumulationWallets} tokens</p>
              </div>
            </div>
            
            {/* Chain & Protocol Preference */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Chain Preference</p>
                {Object.entries(analytics.chainPreference).slice(0, 5).map(([chain, percentage]) => (
                  <div key={chain} className="flex justify-between text-sm py-1">
                    <span className="text-gray-600 dark:text-gray-400">{chain}</span>
                    <span className="text-gray-900 dark:text-white font-medium">{percentage.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Top Tokens</p>
                {analytics.tokenPreference.slice(0, 5).map((token: string) => (
                  <div key={token} className="text-sm py-1 text-gray-600 dark:text-gray-400">
                    • {token}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}