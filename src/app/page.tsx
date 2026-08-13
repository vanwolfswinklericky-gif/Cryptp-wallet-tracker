'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WalletOverview from '@/components/WalletOverview';
import TokenHoldings from '@/components/TokenHoldings';
import PortfolioChart from '@/components/PortfolioChart';
import RecentTransactions from '@/components/RecentTransactions';
import AssetAllocation from '@/components/AssetAllocation';
import WalletInput from '@/components/WalletInput';

const queryClient = new QueryClient();

export default function Home() {
  const [walletAddress, setWalletAddress] = useState(
    '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' // Example wallet
  );

  return (
    <QueryClientProvider client={queryClient}>
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
            Crypto Wallet Tracker
          </h1>
          
          <WalletInput onAddressSubmit={setWalletAddress} />
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            <div className="lg:col-span-2">
              <WalletOverview address={walletAddress} />
            </div>
            <div className="lg:col-span-1">
              <AssetAllocation address={walletAddress} />
            </div>
          </div>
          
          <div className="mt-6">
            <PortfolioChart address={walletAddress} />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            <div className="lg:col-span-2">
              <TokenHoldings address={walletAddress} />
            </div>
            <div className="lg:col-span-1">
              <RecentTransactions address={walletAddress} />
            </div>
          </div>
        </div>
      </main>
    </QueryClientProvider>
  );
}