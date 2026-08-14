// app/page.tsx
'use client';

import { useState, useCallback } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Coins,
  Loader2,
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Image,
  Layers,
  Clock,
  Gauge,
} from 'lucide-react';

import DashboardLayout from '@/components/DashboardLayout';
import WalletInput from '@/components/WalletInput';
import WalletOverview from '@/components/WalletOverview';
import TokenHoldings from '@/components/TokenHoldings';
import RecentTransactions from '@/components/RecentTransactions';
import PortfolioChart from '@/components/PortfolioChart';
import LivePrices from '@/components/LivePrices';
import ThemeToggle from '@/components/ThemeToggle';
import AssetAllocation from '@/components/AssetAllocation';
import NFTGallery from '@/components/nft/NFTGallery';
import NFTStats from '@/components/nft/NFTStats';
import PortfolioHistory from '@/components/dashboard/PortfolioHistory';
import DeFiPositions from '@/components/defi/DeFiPositions';
import PerformanceMetrics from '@/components/dashboard/PerformanceMetrics';

export default function Home() {
  console.log('🚀 Crypto Wallet Tracker v2.0 - 6 Tabs Loaded');

  const [address, setAddress] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<{ date: string; value: number }[]>([]);
  const [allocation, setAllocation] = useState<{ name: string; value: number; color: string }[]>([]);
  const [showNFTs, setShowNFTs] = useState(true);
  const [hasNFTs, setHasNFTs] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'tokens' | 'defi' | 'nfts' | 'history' | 'performance'>('overview');

  // Build chart data from transactions
  const buildChartData = useCallback((transactions: any[], walletAddress: string, currentBalance: number) => {
    console.log('📊 Building chart data...');
    console.log('💰 Current balance:', currentBalance);
    
    if (currentBalance > 0) {
      const data = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        data.push({
          date: date.toISOString().split('T')[0],
          value: currentBalance
        });
      }
      console.log('✅ Chart data built (balance-based):', data.length, 'points');
      return data;
    }

    if (!transactions || transactions.length === 0) {
      console.log('⚠️ No data available');
      return [{ date: new Date().toISOString().split('T')[0], value: 0 }];
    }

    const sorted = [...transactions].sort((a, b) => 
      parseInt(a.timeStamp) - parseInt(b.timeStamp)
    );

    const dailyBalances: { [key: string]: number } = {};
    let runningBalance = 0;

    sorted.forEach(tx => {
      const date = new Date(parseInt(tx.timeStamp) * 1000).toISOString().split('T')[0];
      const value = parseFloat(tx.value) / 1e18;
      const isIncoming = tx.to?.toLowerCase() === walletAddress?.toLowerCase();
      const amount = isIncoming ? value : -value;
      runningBalance += amount;
      dailyBalances[date] = Math.max(0, runningBalance);
    });

    const result = Object.entries(dailyBalances).map(([date, value]) => ({
      date,
      value
    }));
    
    console.log('✅ Chart data built (transaction-based):', result.length, 'points');
    return result;
  }, []);

  // Build asset allocation from tokens
  const buildAllocation = useCallback((tokens: any[]) => {
    if (!tokens || tokens.length === 0) {
      return [
        { name: 'ETH', value: 100, color: '#627EEA' }
      ];
    }

    const colors = ['#627EEA', '#2775CA', '#F5AC37', '#FF6B6B', '#6C5CE7', '#00B894', '#FD79A8', '#00CEC9'];
    
    const totalValue = tokens.reduce((sum, token) => {
      const balance = parseFloat(token.balance) / Math.pow(10, token.decimals);
      return sum + balance;
    }, 0);

    if (totalValue === 0) {
      return [{ name: 'ETH', value: 100, color: '#627EEA' }];
    }

    return tokens.slice(0, 6).map((token, index) => {
      const balance = parseFloat(token.balance) / Math.pow(10, token.decimals);
      const value = (balance / totalValue) * 100;
      return {
        name: token.tokenSymbol || 'Unknown',
        value: Math.max(0, value),
        color: colors[index % colors.length]
      };
    });
  }, []);

  const handleAddressSubmit = async (addr: string, chain: string) => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const response = await fetch(
        `/api/wallet/${addr}?includeTxs=true&chain=${chain}`
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch wallet data');
      }

      console.log('✅ API Response received');
      console.log('📊 Balance:', result.balance);
      console.log('📝 Transactions:', result.transactions?.length || 0);
      console.log('🪙 Tokens:', result.tokens?.length || 0);
      console.log('🔗 Chain:', result.chainName);

      setData(result);
      setAddress(addr);
      
      const chartDataFromTxs = buildChartData(result.transactions, addr, result.balance);
      setChartData(chartDataFromTxs);
      
      const allocationData = buildAllocation(result.tokens);
      setAllocation(allocationData);
      
      // ✅ Check if wallet has NFTs
      try {
        const nftCheck = await fetch(`/api/nft/has?address=${addr}&chain=${chain}`);
        const nftData = await nftCheck.json();
        setHasNFTs(nftData.hasNFTs || false);
      } catch (nftError) {
        console.log('NFT check failed:', nftError);
        setHasNFTs(false);
      }
      
    } catch (err) {
      console.error('❌ Error fetching wallet data:', err);
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred'
      );
    } finally {
      setLoading(false);
    }
  };

  // Tab configuration
  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'tokens', label: 'Tokens', icon: Coins },
    { id: 'defi', label: 'DeFi', icon: Layers },
    { id: 'nfts', label: 'NFTs', icon: Image },
    { id: 'history', label: 'History', icon: Clock },
    { id: 'performance', label: 'PnL', icon: Gauge },
  ] as const;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                CRYPTO WALLET TRACKER
              </span>
              <span className="text-xs font-normal text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-full">
                v2.0 • 6 Tabs
              </span>
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Track balances, tokens, transactions, and portfolio activities across multiple chains.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 rounded-full">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-xs font-medium text-green-700 dark:text-green-300">Live</span>
            </div>
            <ThemeToggle />
          </div>
        </header>

        {/* Wallet Input */}
        <section className="mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 sm:p-8 transition-all hover:shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 7h15a2 2 0 0 1 2 2v10H4a2 2 0 0 1-2-2V7Z" />
                  <path d="M4 7V5a2 2 0 0 1 2-2h13v4" />
                  <path d="M16 13h5" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Track a wallet</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Enter a wallet address to view its portfolio and activity across multiple chains.
                </p>
                <div className="mt-4">
                  <WalletInput onAddressSubmit={handleAddressSubmit} isLoading={loading} />
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {['Ethereum', 'Polygon', 'BSC', 'Arbitrum', 'Optimism', 'Avalanche', 'Base'].map((chain) => (
                    <span key={chain} className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                      {chain}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="flex items-center gap-4 bg-white dark:bg-gray-800 rounded-2xl px-8 py-6 shadow-lg border border-gray-200 dark:border-gray-700">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Loading wallet data</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Fetching balances and transactions...</p>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex justify-center py-4">
            <div className="flex items-start gap-3 max-w-2xl w-full bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-2xl p-4">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-800 dark:text-red-300">Unable to load wallet</p>
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard */}
        {data && !loading && (
          <>
            {/* Overview Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">WALLET OVERVIEW</h2>
              </div>
              {data.chainName && (
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium">
                  {data.chainName}
                </span>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                    <Wallet className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Wallet Address</span>
                </div>
                <p className="text-lg font-mono font-semibold text-gray-900 dark:text-white">
                  {address.slice(0, 6)}...{address.slice(-4)}
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                    <Activity className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Transactions</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.transactions?.length || 0}</p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg">
                    <Coins className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Tokens</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.tokens?.length || 0}</p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Balance ({data.chainName || 'Ethereum'})</span>
                </div>
                <div className="flex items-end gap-2">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {(data.balance || 0).toFixed(4)}
                  </p>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-0.5">
                    {data.symbol || 'ETH'}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-1 text-sm text-green-600 dark:text-green-400">
                  <TrendingUp className="w-3 h-3" />
                  <span>+2.5%</span>
                </div>
              </div>
            </div>

            {/* ✅ Tabs - Enterprise Grade with Centered Layout */}
            <div className="flex justify-center mb-8">
              <div className="inline-flex flex-wrap justify-center gap-1 p-1.5 bg-gray-100 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  const isNew = tab.id === 'defi' || tab.id === 'performance';
                  
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`
                        relative px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300
                        flex items-center gap-2 whitespace-nowrap
                        ${isActive 
                          ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-lg ring-2 ring-blue-500/20 dark:ring-blue-400/20 scale-105' 
                          : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-700/50'
                        }
                      `}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                      <span>{tab.label}</span>
                      
                      {tab.id === 'nfts' && hasNFTs && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse ring-2 ring-white dark:ring-gray-800" />
                      )}
                      
                      {isNew && (
                        <span className="text-[10px] font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-white px-2 py-0.5 rounded-full ml-1">
                          NEW
                        </span>
                      )}
                    </button>
                  );
                })}
                <div className="flex items-center px-3 py-1 text-xs text-gray-400 dark:text-gray-500 border-l border-gray-200 dark:border-gray-700">
                  v2.0
                </div>
              </div>
            </div>

            {/* Tab Content */}
            <div className="space-y-6">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <>
                  {/* Main Grid - Chart and Prices */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Portfolio Value
                          <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                            (30 days)
                          </span>
                        </h3>
                      </div>
                      <div className="h-64">
                        <PortfolioChart data={chartData} isLoading={loading} />
                      </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Live Prices
                      </h3>
                      <LivePrices chain={data?.chain || 'ethereum'} tokens={data?.tokens || []} />
                    </div>
                  </div>

                  {/* NFT Gallery */}
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                          <Image className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          NFT Gallery
                        </h3>
                        {hasNFTs && (
                          <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded-full">
                            🟢 {data.chainName || 'Ethereum'}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setShowNFTs(!showNFTs)}
                        className="text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition-colors"
                      >
                        {showNFTs ? 'Hide' : 'Show'} NFTs
                      </button>
                    </div>

                    {showNFTs && (
                      <div className="space-y-4">
                        <NFTStats address={address} chain={data?.chain || 'ethereum'} />
                        <NFTGallery address={address} chain={data?.chain || 'ethereum'} />
                      </div>
                    )}
                  </div>

                  {/* Lower Grid - Holdings and Transactions */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Token Holdings
                        </h3>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {data.tokens?.length || 0} Assets
                        </span>
                      </div>
                      <TokenHoldings tokens={data.tokens || []} chain={data?.chain || 'ethereum'} />
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Recent Transactions
                        </h3>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {data.transactions?.length || 0} total
                        </span>
                      </div>
                      <RecentTransactions transactions={data.transactions || []} />
                    </div>
                  </div>

                  {/* Asset Allocation */}
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Asset Allocation
                    </h3>
                    <AssetAllocation allocation={allocation} isLoading={loading} />
                  </div>
                </>
              )}

              {/* Tokens Tab */}
              {activeTab === 'tokens' && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Token Holdings
                  </h3>
                  <TokenHoldings tokens={data.tokens || []} chain={data?.chain || 'ethereum'} />
                </div>
              )}

              {/* DeFi Tab */}
              {activeTab === 'defi' && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    DeFi Positions
                  </h3>
                  <DeFiPositions address={address} chain={data?.chain || 'ethereum'} />
                </div>
              )}

              {/* NFTs Tab */}
              {activeTab === 'nfts' && (
                <div className="space-y-4">
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                    <NFTStats address={address} chain={data?.chain || 'ethereum'} />
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                    <NFTGallery address={address} chain={data?.chain || 'ethereum'} />
                  </div>
                </div>
              )}

              {/* History Tab */}
              {activeTab === 'history' && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Portfolio History
                  </h3>
                  <PortfolioHistory address={address} chain={data?.chain || 'ethereum'} />
                </div>
              )}

              {/* Performance Tab */}
              {activeTab === 'performance' && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Performance & PnL
                  </h3>
                  <PerformanceMetrics address={address} chain={data?.chain || 'ethereum'} />
                </div>
              )}
            </div>

            {/* Bottom Grid - Network Info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                    <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Network</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{data.chainName || 'Ethereum'}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
                    <Coins className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Assets</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{data.tokens?.length || 0}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-50 dark:bg-rose-900/30 rounded-lg">
                    <ArrowUpRight className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Transactions</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{data.transactions?.length || 0}</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}