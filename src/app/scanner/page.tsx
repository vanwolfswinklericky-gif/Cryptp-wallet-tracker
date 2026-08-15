// src/app/scanner/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity,
  BarChart3,
  Clock,
  Zap,
  Users,
  Wallet as WalletIcon
} from 'lucide-react';

import DashboardLayout from '@/components/DashboardLayout';
import ScannerFilters, { ScannerFilters as FilterType } from '@/components/scanner/ScannerFilters';
import ScannerResults, { WalletResult } from '@/components/scanner/ScannerResults';
import { getScannerWallets, getTrendingWallets, getTopPerformers, getWhales } from '@/lib/api/scanner';

export default function ScannerPage() {
  const [filters, setFilters] = useState<FilterType>({});
  const [wallets, setWallets] = useState<WalletResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const presets = [
    {
      id: 'top-performers',
      label: '🏆 Top Performers',
      icon: <TrendingUp className="w-4 h-4" />,
      filters: { minPerformance: 20, minTrades: 30, minWalletScore: 70 }
    },
    {
      id: 'smart-money',
      label: '🧠 Smart Money',
      icon: <Zap className="w-4 h-4" />,
      filters: { minWalletScore: 85, minWinRate: 60, maxDrawdown: 20, minTrades: 50 }
    },
    {
      id: 'whales',
      label: '🐋 Whales',
      icon: <WalletIcon className="w-4 h-4" />,
      filters: { minPnL: 50000, minTrades: 20 }
    },
    {
      id: 'trending',
      label: '🔥 Trending',
      icon: <Activity className="w-4 h-4" />,
      filters: { minPerformance: 15, minTrades: 10 }
    },
  ];

  const handleSearch = async () => {
    setLoading(true);
    try {
      const results = await getScannerWallets(filters);
      setWallets(results);
    } catch (error) {
      console.error('Scanner error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreset = async (presetId: string) => {
    setActivePreset(presetId);
    setLoading(true);
    
    try {
      let results: WalletResult[] = [];
      
      switch (presetId) {
        case 'top-performers':
          results = await getTopPerformers('30d', 20);
          break;
        case 'trending':
          results = await getTrendingWallets(20);
          break;
        case 'whales':
          results = await getWhales(20);
          break;
        case 'smart-money':
          results = await getScannerWallets(
            presets.find(p => p.id === 'smart-money')?.filters || {}
          );
          break;
        default:
          results = [];
      }
      
      setWallets(results);
      setFilters({});
    } catch (error) {
      console.error('Preset error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectWallet = (address: string) => {
    window.location.href = `/wallet/${address}`;
  };

  return (
    <DashboardLayout 
      title="Wallet Scanner" 
      subtitle="Discover high-performance wallets across multiple chains"
    >
      {/* Presets */}
      <div className="flex flex-wrap gap-2 mb-6">
        {presets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => handlePreset(preset.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all duration-200 ${
              activePreset === preset.id
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            }`}
          >
            {preset.icon}
            {preset.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <ScannerFilters 
        filters={filters}
        onFilterChange={setFilters}
        onSearch={handleSearch}
        isLoading={loading}
      />

      {/* Results */}
      <div className="mt-6">
        <ScannerResults 
          wallets={wallets}
          isLoading={loading}
          onSelectWallet={handleSelectWallet}
        />
      </div>

      {/* Stats Summary */}
      {wallets.length > 0 && !loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Wallets</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{wallets.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">Avg PnL</p>
            <p className="text-lg font-bold text-green-600 dark:text-green-400">
              ${(wallets.reduce((sum, w) => sum + w.pnl, 0) / wallets.length).toFixed(2)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">Avg Win Rate</p>
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {(wallets.reduce((sum, w) => sum + w.winRate, 0) / wallets.length).toFixed(1)}%
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Volume</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              ${(wallets.reduce((sum, w) => sum + w.volume, 0) / 1e6).toFixed(1)}M
            </p>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}