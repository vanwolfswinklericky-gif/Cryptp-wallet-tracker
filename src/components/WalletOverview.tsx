'use client';

import { Wallet, Coins, Activity, TrendingUp } from 'lucide-react';

interface Props {
  address: string;
  balance: number;
  transactionsCount: number;
  tokensCount: number;
  chainName?: string;
  symbol?: string;
  isLoading?: boolean;
}

const formatAddress = (address: string) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export default function WalletOverview({
  address,
  balance,
  transactionsCount,
  tokensCount,
  chainName = 'Ethereum',
  symbol = 'ETH',
  isLoading = false,
}: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-gray-200/80 bg-white/80 backdrop-blur-sm p-6 shadow-sm dark:border-gray-700/50 dark:bg-gray-800/80"
          >
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        icon={<Wallet className="h-5 w-5" />}
        label="Wallet Address"
        value={formatAddress(address)}
        iconClass="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
      />
      <SummaryCard
        icon={<Coins className="h-5 w-5" />}
        label={`Balance (${chainName})`}
        value={`${balance.toFixed(4)} ${symbol}`}
        iconClass="bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
        change="+2.5%"
        changeType="positive"
      />
      <SummaryCard
        icon={<Activity className="h-5 w-5" />}
        label="Transactions"
        value={String(transactionsCount)}
        iconClass="bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
      />
      <SummaryCard
        icon={<TrendingUp className="h-5 w-5" />}
        label="Tokens"
        value={String(tokensCount)}
        iconClass="bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
      />
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  iconClass,
  change,
  changeType = 'neutral',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  iconClass: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
}) {
  const changeColors = {
    positive: 'text-green-600 dark:text-green-400',
    negative: 'text-red-600 dark:text-red-400',
    neutral: 'text-gray-500 dark:text-gray-400',
  };

  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white/80 backdrop-blur-sm p-6 shadow-sm transition-all duration-200 hover:shadow-md dark:border-gray-700/50 dark:bg-gray-800/80">
      <div className="flex flex-col items-center text-center">
        <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${iconClass}`}>
          {icon}
        </div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {label}
        </p>
        <p className="mt-1.5 text-sm font-semibold text-gray-900 dark:text-white">
          {value}
        </p>
        {change && (
          <p className={`mt-1 text-xs font-medium ${changeColors[changeType]}`}>
            {change}
          </p>
        )}
      </div>
    </div>
  );
}