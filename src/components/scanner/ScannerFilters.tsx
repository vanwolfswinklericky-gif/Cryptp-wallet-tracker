// src/components/scanner/ScannerFilters.tsx
'use client';

import { useState } from 'react';
import { Filter, X, Search, ChevronDown, ChevronUp } from 'lucide-react';

export interface ScannerFilters {
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

interface Props {
  filters: ScannerFilters;
  onFilterChange: (filters: ScannerFilters) => void;
  onSearch: () => void;
  isLoading?: boolean;
}

const CHAIN_OPTIONS = [
  { value: 'ethereum', label: 'Ethereum' },
  { value: 'polygon', label: 'Polygon' },
  { value: 'bsc', label: 'BSC' },
  { value: 'arbitrum', label: 'Arbitrum' },
  { value: 'optimism', label: 'Optimism' },
  { value: 'avalanche', label: 'Avalanche' },
  { value: 'base', label: 'Base' },
  { value: 'solana', label: 'Solana' },
];

const TOKEN_OPTIONS = [
  { value: 'ETH', label: 'ETH' },
  { value: 'USDC', label: 'USDC' },
  { value: 'USDT', label: 'USDT' },
  { value: 'WBTC', label: 'WBTC' },
  { value: 'LINK', label: 'LINK' },
  { value: 'UNI', label: 'UNI' },
  { value: 'MATIC', label: 'MATIC' },
  { value: 'BNB', label: 'BNB' },
  { value: 'ARB', label: 'ARB' },
  { value: 'OP', label: 'OP' },
  { value: 'AVAX', label: 'AVAX' },
];

const PROTOCOL_OPTIONS = [
  { value: 'uniswap', label: 'Uniswap' },
  { value: 'aave', label: 'Aave' },
  { value: 'compound', label: 'Compound' },
  { value: 'curve', label: 'Curve' },
  { value: 'balancer', label: 'Balancer' },
  { value: 'aerodrome', label: 'Aerodrome' },
  { value: 'pancakeswap', label: 'PancakeSwap' },
  { value: 'quickswap', label: 'QuickSwap' },
];

export default function ScannerFilters({ filters, onFilterChange, onSearch, isLoading }: Props) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleChange = (key: keyof ScannerFilters, value: any) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const handleMultiSelect = (key: 'chains' | 'tokens' | 'protocols', value: string) => {
    const current = filters[key] || [];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    handleChange(key, updated.length > 0 ? updated : undefined);
  };

  const clearFilters = () => {
    onFilterChange({});
  };

  const hasActiveFilters = Object.keys(filters).some(key => {
    const value = filters[key as keyof ScannerFilters];
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== '';
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
            <Filter className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Wallet Scanner
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Find wallets based on performance criteria
            </p>
          </div>
          {hasActiveFilters && (
            <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full">
              {Object.keys(filters).filter(key => {
                const val = filters[key as keyof ScannerFilters];
                if (Array.isArray(val)) return val.length > 0;
                return val !== undefined;
              }).length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={(e) => { e.stopPropagation(); clearFilters(); }}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Filter Content */}
      {isExpanded && (
        <div className="p-4 pt-0 border-t border-gray-100 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            {/* PnL Range */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                PnL Range ($)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.minPnL || ''}
                  onChange={(e) => handleChange('minPnL', e.target.value ? parseFloat(e.target.value) : undefined)}
                  className="w-1/2 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.maxPnL || ''}
                  onChange={(e) => handleChange('maxPnL', e.target.value ? parseFloat(e.target.value) : undefined)}
                  className="w-1/2 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Win Rate */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Min Win Rate (%)
              </label>
              <input
                type="number"
                placeholder="e.g. 60"
                value={filters.minWinRate || ''}
                onChange={(e) => handleChange('minWinRate', e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Min Trades */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Min Trades
              </label>
              <input
                type="number"
                placeholder="e.g. 50"
                value={filters.minTrades || ''}
                onChange={(e) => handleChange('minTrades', e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Performance */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Min 90-Day Performance (%)
              </label>
              <input
                type="number"
                placeholder="e.g. 20"
                value={filters.minPerformance || ''}
                onChange={(e) => handleChange('minPerformance', e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Max Drawdown */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Drawdown (%)
              </label>
              <input
                type="number"
                placeholder="e.g. 30"
                value={filters.maxDrawdown || ''}
                onChange={(e) => handleChange('maxDrawdown', e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Min Wallet Score */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Min Wallet Score
              </label>
              <input
                type="number"
                placeholder="e.g. 80"
                value={filters.minWalletScore || ''}
                onChange={(e) => handleChange('minWalletScore', e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Chains */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Chains
              </label>
              <div className="flex flex-wrap gap-1">
                {CHAIN_OPTIONS.slice(0, 4).map((chain) => (
                  <button
                    key={chain.value}
                    onClick={() => handleMultiSelect('chains', chain.value)}
                    className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                      (filters.chains || []).includes(chain.value)
                        ? 'bg-blue-600 text-white dark:bg-blue-500'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {chain.label}
                  </button>
                ))}
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {showAdvanced ? 'Less' : 'More'}
                </button>
              </div>
            </div>
          </div>

          {/* Advanced Filters */}
          {showAdvanced && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Preferred Tokens
                </label>
                <div className="flex flex-wrap gap-1">
                  {TOKEN_OPTIONS.map((token) => (
                    <button
                      key={token.value}
                      onClick={() => handleMultiSelect('tokens', token.value)}
                      className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                        (filters.tokens || []).includes(token.value)
                          ? 'bg-blue-600 text-white dark:bg-blue-500'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {token.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Preferred Protocols
                </label>
                <div className="flex flex-wrap gap-1">
                  {PROTOCOL_OPTIONS.map((protocol) => (
                    <button
                      key={protocol.value}
                      onClick={() => handleMultiSelect('protocols', protocol.value)}
                      className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                        (filters.protocols || []).includes(protocol.value)
                          ? 'bg-blue-600 text-white dark:bg-blue-500'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {protocol.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Search Button */}
          <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={onSearch}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors text-sm font-medium"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Scan Wallets
                </>
              )}
            </button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors text-sm font-medium"
              >
                Clear All
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}