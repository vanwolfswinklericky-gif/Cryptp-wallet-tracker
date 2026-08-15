// src/components/scanner/ScannerResults.tsx
'use client';

import { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Copy,
  Check
} from 'lucide-react';

export interface WalletResult {
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

interface Props {
  wallets: WalletResult[];
  isLoading?: boolean;
  onSelectWallet?: (address: string) => void;
}

export default function ScannerResults({ wallets, isLoading = false, onSelectWallet }: Props) {
  const [sortField, setSortField] = useState<keyof WalletResult>('walletScore');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-blue-200 dark:border-blue-900/50 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
          </div>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Scanning wallets across chains...
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            This may take a few moments
          </p>
        </div>
      </div>
    );
  }

  if (!wallets || wallets.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Wallet className="w-12 h-12 text-gray-300 dark:text-gray-600" />
          <p className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300">
            No wallets found
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm">
            Try adjusting your filters or criteria to find more wallets
          </p>
        </div>
      </div>
    );
  }

  const sortedWallets = [...wallets].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
    }
    return 0;
  });

  const handleSort = (field: keyof WalletResult) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const formatNumber = (num: number, decimals: number = 2) => {
    if (num === 0) return '0';
    if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toFixed(decimals);
  };

  const formatCurrency = (num: number) => {
    if (num === 0) return '$0';
    return `$${formatNumber(num)}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const SortableHeader = ({ field, label }: { field: keyof WalletResult; label: string }) => (
    <th 
      className="px-3 py-2 text-left cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400">
        {label}
        {sortField === field && (
          sortDirection === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
        )}
      </div>
    </th>
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg">
            <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {wallets.length} Wallets Found
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Sorted by {sortField} {sortDirection === 'desc' ? '↓' : '↑'}
            </p>
          </div>
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {wallets.length} results
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 w-8">#</th>
              <SortableHeader field="address" label="Wallet" />
              <SortableHeader field="pnl" label="PnL" />
              <SortableHeader field="roi" label="ROI" />
              <SortableHeader field="winRate" label="Win Rate" />
              <SortableHeader field="tradeCount" label="Trades" />
              <SortableHeader field="walletScore" label="Score" />
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {sortedWallets.map((wallet, index) => (
              <tr 
                key={wallet.address}
                className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer"
                onClick={() => onSelectWallet?.(wallet.address)}
              >
                <td className="px-3 py-3 text-xs text-gray-400 dark:text-gray-500">
                  {index + 1}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                      {wallet.address.slice(2, 4).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-gray-900 dark:text-white">
                          {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); copyAddress(wallet.address); }}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                          {copiedAddress === wallet.address ? (
                            <Check className="w-3 h-3 text-green-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                        <a
                          href={`https://etherscan.io/address/${wallet.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                          {wallet.chain}
                        </span>
                        {wallet.chains.slice(0, 2).map((c) => (
                          c !== wallet.chain && (
                            <span key={c} className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                              {c}
                            </span>
                          )
                        ))}
                        {wallet.chains.length > 2 && (
                          <span className="text-[10px] text-gray-400">+{wallet.chains.length - 2}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span className={`text-xs font-semibold ${wallet.pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {wallet.pnl >= 0 ? '+' : ''}{formatCurrency(wallet.pnl)}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span className={`text-xs font-semibold ${wallet.roi >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {wallet.roi >= 0 ? '+' : ''}{wallet.roi.toFixed(1)}%
                  </span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 dark:bg-blue-400 rounded-full transition-all"
                        style={{ width: `${Math.min(wallet.winRate, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {wallet.winRate.toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-gray-700 dark:text-gray-300">
                  {wallet.tradeCount}
                </td>
                <td className="px-3 py-3">
                  <span className={`text-xs font-bold ${getScoreColor(wallet.walletScore)}`}>
                    {wallet.walletScore}
                  </span>
                </td>
                <td className="px-3 py-3 text-right">
                  <button
                    onClick={(e) => { e.stopPropagation(); onSelectWallet?.(wallet.address); }}
                    className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}