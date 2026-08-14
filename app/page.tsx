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
  ArrowUpRight,
  Image,
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

export default function Home() {
  const [address, setAddress] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<{ date: string; value: number }[]>([]);
  const [allocation, setAllocation] = useState<{ name: string; value: number; color: string }[]>([]);
  const [showNFTs, setShowNFTs] = useState(true);
  const [hasNFTs, setHasNFTs] = useState(false);

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

  return (
    <div className="cwt-page">
      {/* Header */}
      <header className="cwt-header">
        <div className="cwt-header-left">
          <h1 className="cwt-header-title">CRYPTO WALLET TRACKER</h1>
          <p className="cwt-header-subtitle">
            Track balances, tokens, transactions, and portfolio activities.
          </p>
        </div>
        <div className="cwt-header-right">
          <div className="cwt-live-badge">Live</div>
          <ThemeToggle />
        </div>
      </header>

      {/* Wallet Input */}
      <section className="cwt-wallet-section">
        <div className="cwt-wallet-card">
          <div className="cwt-wallet-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M4 7h15a2 2 0 0 1 2 2v10H4a2 2 0 0 1-2-2V7Z" />
              <path d="M4 7V5a2 2 0 0 1 2-2h13v4" />
              <path d="M16 13h5" />
            </svg>
          </div>
          <h2 className="cwt-wallet-title">Track a wallet</h2>
          <p className="cwt-wallet-desc">
            Enter a wallet address to view its portfolio and activity.
          </p>
          <WalletInput onAddressSubmit={handleAddressSubmit} />
          <p className="cwt-wallet-supported">
            Supports: Ethereum, Polygon, BSC, Arbitrum, Optimism, Avalanche, Base
          </p>
        </div>
      </section>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="flex items-center gap-3 rounded-2xl border border-gray-300 bg-white px-6 py-4 shadow-sm dark:border-gray-600 dark:bg-gray-800">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                Loading wallet data
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Fetching balances and transactions...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="flex justify-center py-4">
          <div className="flex w-full max-w-2xl items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/20">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <div>
              <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                Unable to load wallet
              </p>
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard */}
      {data && !loading && (
        <>
          {/* Overview */}
          <div className="cwt-overview">
            <div className="cwt-overview-heading">
              <BarChart3 className="cwt-overview-icon" />
              <h2>WALLET OVERVIEW</h2>
            </div>
            {data.chainName && (
              <span className="cwt-overview-pill">{data.chainName}</span>
            )}
          </div>

          {/* Stats Grid */}
          <div className="cwt-stats-grid">
            <div className="cwt-stat-card">
              <div className="cwt-stat-icon">
                <Wallet className="w-full h-full" />
              </div>
              <div className="cwt-stat-label">Wallet Address</div>
              <div className="cwt-stat-value">
                {address.slice(0, 6)}...{address.slice(-4)}
              </div>
            </div>

            <div className="cwt-stat-card">
              <div className="cwt-stat-icon">
                <TrendingUp className="w-full h-full" />
              </div>
              <div className="cwt-stat-label">Transactions</div>
              <div className="cwt-stat-value">{data.transactions?.length || 0}</div>
            </div>

            <div className="cwt-stat-card">
              <div className="cwt-stat-icon">
                <Coins className="w-full h-full" />
              </div>
              <div className="cwt-stat-label">Tokens</div>
              <div className="cwt-stat-value">{data.tokens?.length || 0}</div>
            </div>

            <div className="cwt-stat-card">
              <div className="cwt-stat-icon">
                <Activity className="w-full h-full" />
              </div>
              <div className="cwt-stat-label">Balance ({data.chainName || 'Ethereum'})</div>
              <div className="cwt-stat-value">
                {(data.balance || 0).toFixed(4)} {data.symbol || 'ETH'}
              </div>
              <div className="cwt-stat-change">+2.5%</div>
            </div>
          </div>

          {/* Main Grid */}
          <div className="cwt-main-grid">
            <div className="cwt-portfolio-card">
              <div className="cwt-portfolio-header">
                <h3>
                  Portfolio Value
                  <span> (30 days Value Performance)</span>
                </h3>
              </div>
              <div className="cwt-portfolio-chart">
                <PortfolioChart data={chartData} isLoading={loading} />
              </div>
            </div>

            <div className="cwt-price-card">
              <div className="cwt-price-header">
                <h3>Live Price</h3>
              </div>
              <LivePrices chain={data?.chain || 'ethereum'} tokens={data?.tokens || []} />
            </div>
          </div>

          {/* Lower Grid */}
          <div className="cwt-lower-grid">
            <div className="cwt-holdings-card">
              <div className="cwt-holdings-header">
                <h3>Token Holdings</h3>
                <p>{data.tokens?.length || 0} Assets</p>
              </div>
              <TokenHoldings tokens={data.tokens || []} chain={data?.chain || 'ethereum'} />
            </div>

            <div className="cwt-transactions-card">
              <div className="cwt-transactions-header">
                <h3>Recent Transactions</h3>
                <p>{data.transactions?.length || 0} total</p>
              </div>
              <RecentTransactions transactions={data.transactions || []} />
            </div>
          </div>

          {/* ✅ NFT Section - Clean Integration */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                  <Image className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  NFT Gallery
                </h2>
                {hasNFTs && (
                  <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-full">
                    {data.chainName || 'Ethereum'}
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
                {/* ✅ NFT Stats */}
                <NFTStats address={address} chain={data?.chain || 'ethereum'} />
                
                {/* ✅ NFT Gallery */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
                  <NFTGallery address={address} chain={data?.chain || 'ethereum'} />
                </div>
              </div>
            )}
          </div>

          {/* Bottom Grid */}
          <div className="cwt-bottom-grid">
            <div className="cwt-bottom-card">
              <div className="cwt-bottom-icon">
                <Activity className="w-full h-full" />
              </div>
              <div className="cwt-bottom-label">Network</div>
              <div className="cwt-bottom-value">{data.chainName || 'Ethereum'}</div>
            </div>

            <div className="cwt-bottom-card">
              <div className="cwt-bottom-icon">
                <Coins className="w-full h-full" />
              </div>
              <div className="cwt-bottom-label">Assets</div>
              <div className="cwt-bottom-value">{data.tokens?.length || 0}</div>
            </div>

            <div className="cwt-bottom-card">
              <div className="cwt-bottom-icon">
                <ArrowUpRight className="w-full h-full" />
              </div>
              <div className="cwt-bottom-label">Transactions</div>
              <div className="cwt-bottom-value">{data.transactions?.length || 0}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}