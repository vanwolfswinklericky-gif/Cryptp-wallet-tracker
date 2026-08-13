'use client';

import { AlertCircle } from 'lucide-react';

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
}

interface Props {
  transactions: Transaction[];
  isLoading?: boolean;
}

export default function RecentTransactions({ transactions, isLoading = false }: Props) {
  if (isLoading) {
    return (
      <div className="cwt-transactions-list">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="cwt-transactions-row animate-pulse">
            <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <AlertCircle className="h-8 w-8 text-gray-400 dark:text-gray-500" />
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No transactions found</p>
      </div>
    );
  }

  return (
    <div className="cwt-transactions-list">
      {transactions.slice(0, 5).map((tx, index) => (
        <div key={index} className="cwt-transactions-row">
          <span className="cwt-transactions-address">
            {tx.from?.slice(0, 6)}...{tx.from?.slice(-4)}
          </span>
          <span className="cwt-transactions-amount">
            {(parseFloat(tx.value) / 1e18).toFixed(4)} ETH
          </span>
        </div>
      ))}
    </div>
  );
}