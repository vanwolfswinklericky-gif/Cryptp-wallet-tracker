// app/page.tsx
'use client';

import { useState, useCallback, useMemo } from 'react';
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
  Target,
  Zap,
  Search,
  TrendingUp as TrendingUpIcon,
  Bell,
  Copy,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

// Shadcn UI imports for tooltips
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Component imports
import DashboardLayout from '@/components/DashboardLayout';
import WalletInput from '@/components/WalletInput';
import WalletOverview from '@/components/WalletOverview';
import TokenHoldings from '@/components/TokenHoldings';
import RecentTransactions from '@/components/RecentTransactions';
import PortfolioChart from '@/components/PortfolioChart';
import LivePrices from '@/components/LivePrices';
import AssetAllocation from '@/components/AssetAllocation';
import NFTGallery from '@/components/nft/NFTGallery';
import NFTStats from '@/components/nft/NFTStats';
import PortfolioHistory from '@/components/dashboard/PortfolioHistory';
import ScannerDashboard from '@/components/scanner/ScannerDashboard';
import { WalletManagement } from '@/components/wallets/WalletManagement';
import { ExportButton } from '@/components/export/ExportButton';
import { CopyTradeAlerts } from '@/components/copy-trading/CopyTradeAlerts';

export default function Home() {
  const [address, setAddress] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<{ date: string; value: number }[]>([]);
  const [allocation, setAllocation] = useState<{ name: string; value: number; color: string }[]>([]);
  const [showNFTs, setShowNFTs] = useState(true);
  const [hasNFTs, setHasNFTs] = useState(false);

  // 8 Active Tabs
  const [activeTab, setActiveTab] = useState<
    'overview' | 'tokens' | 'nfts' | 'history' | 'scanner' | 'pnl' | 'wallets' | 'copy-trading'
  >('overview');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'tokens', label: 'Tokens', icon: Coins },
    { id: 'nfts', label: 'NFTs', icon: Image },
    { id: 'history', label: 'History', icon: Clock },
    { id: 'scanner', label: 'Scanner', icon: Target },
    { id: 'copy-trading', label: 'Copy Trading', icon: Bell },
    { id: 'pnl', label: 'PnL', icon: TrendingUpIcon },
    { id: 'wallets', label: 'Wallets', icon: Wallet },
  ] as const;

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

  // ✅ Calculate PnL metrics properly
  const pnlData = useMemo(() => {
    if (!data || !address) return null;
    
    const transactions = data.transactions || [];
    let totalIn = 0;
    let totalOut = 0;
    let winCount = 0;
    let lossCount = 0;
    
    transactions.forEach((tx: any) => {
      const value = parseFloat(tx.value) / 1e18;
      const isIncoming = tx.to?.toLowerCase() === address?.toLowerCase();
      if (isIncoming) {
        totalIn += value;
        winCount++;
      } else {
        totalOut += value;
        lossCount++;
      }
    });
    
    const totalPnL = totalIn - totalOut;
    const totalRoi = totalOut > 0 ? (totalPnL / totalOut) * 100 : 0;
    const winRate = transactions.length > 0 ? (winCount / transactions.length) * 100 : 0;
    
    return {
      totalPnL,
      totalRoi,
      winRate,
      winCount,
      lossCount,
      totalTransactions: transactions.length,
      isProfitable: totalPnL > 0,
    };
  }, [data, address]);

  // ✅ Refresh handler
  const handleRefresh = useCallback(() => {
    if (address && data?.chain) {
      handleAddressSubmit(address, data.chain);
    }
  }, [address, data]);

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
    <TooltipProvider>
      <div className="min-h-screen bg-[#050b08] text-emerald-50/90 relative overflow-x-hidden">
        {/* Ambient background glow */}
        <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_50%_at_50%_-15%,rgba(16,185,129,0.15),rgba(5,11,8,0))] z-0" />

        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-emerald-900/40 bg-[#07140e]/85 backdrop-blur-xl transition-all">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16 sm:h-20">
              {/* Logo and App Title */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-900/30 border border-emerald-500/40 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.25)] text-emerald-400">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-base sm:text-lg font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-200 to-emerald-100">
                      CRYPTO WALLET TRACKER
                    </h1>
                    <span className="hidden sm:inline-flex text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Pro
                    </span>
                  </div>
                  <p className="text-xs text-emerald-100/50 hidden sm:block">
                    Live multi-chain analytics, token balances, and transaction scanner
                  </p>
                </div>
              </div>

              {/* Header Right Actions */}
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#0a1f15] border border-emerald-500/30 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="tracking-wide">LIVE</span>
                </div>
                
                {/* ✅ Refresh Button */}
                {data && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleRefresh}
                        className="p-2 rounded-lg hover:bg-emerald-500/10 text-emerald-400/70 hover:text-emerald-300 transition-all"
                        aria-label="Refresh wallet data"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Refresh wallet data</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                
                {data && (
                  <div className="hover:opacity-90 transition-opacity">
                    <ExportButton type="holdings" label="Export" variant="outline" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          {/* Wallet Input Section */}
          <section className="relative rounded-2xl border border-emerald-900/40 bg-gradient-to-b from-[#091b13]/90 via-[#071610]/80 to-[#050f0b]/90 p-6 sm:p-8 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.6)]">
            <div className="max-w-3xl mx-auto text-center space-y-4">
              <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                <Search className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Track Any Web3 Wallet
                </h2>
                <p className="text-sm text-emerald-100/60 mt-1">
                  Enter an EVM address or ENS name to inspect live balances, token positions, and historical performance.
                </p>
              </div>

              <div className="pt-2">
                <WalletInput onAddressSubmit={handleAddressSubmit} isLoading={loading} />
              </div>

              {/* Chain Pills */}
              <div className="pt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-emerald-100/60">
                <span className="text-emerald-400/80 font-medium">Supported Chains:</span>
                {[
                  { name: 'Ethereum', dot: 'bg-emerald-400' },
                  { name: 'Polygon', dot: 'bg-purple-400' },
                  { name: 'BSC', dot: 'bg-yellow-400' },
                  { name: 'Arbitrum', dot: 'bg-blue-400' },
                  { name: 'Optimism', dot: 'bg-red-400' },
                  { name: 'Avalanche', dot: 'bg-rose-500' },
                  { name: 'Base', dot: 'bg-teal-400' },
                ].map((chain) => (
                  <span
                    key={chain.name}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#081711] border border-emerald-900/60 text-emerald-200/80 hover:border-emerald-500/40 transition-colors"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${chain.dot}`} />
                    {chain.name}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* Loading State */}
          {loading && (
            <div className="flex justify-center py-12">
              <div className="flex items-center gap-4 rounded-2xl border border-emerald-500/30 bg-[#0a1f15]/90 px-8 py-5 shadow-[0_0_30px_rgba(16,185,129,0.2)] backdrop-blur-md">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
                <div>
                  <p className="text-sm font-semibold text-white">Loading On-Chain Intelligence</p>
                  <p className="text-xs text-emerald-100/60">Fetching verified token balances & transactions...</p>
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="flex justify-center py-4">
              <div className="flex w-full max-w-2xl items-start gap-3.5 rounded-2xl border border-rose-900/50 bg-[#170a0e]/90 p-5 shadow-[0_0_20px_rgba(244,63,94,0.15)]">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
                <div>
                  <p className="text-sm font-semibold text-rose-200">Unable to load wallet data</p>
                  <p className="text-xs text-rose-300/80 mt-0.5">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Dashboard Panels */}
          {data && !loading && (
            <div className="space-y-6">
              {/* Overview Heading */}
              <div className="flex items-center justify-between pb-2 border-b border-emerald-900/30">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-wide">WALLET OVERVIEW</h2>
                    <p className="text-xs text-emerald-100/50 font-mono">
                      {address}
                    </p>
                  </div>
                </div>
                {data.chainName && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
                    {data.chainName}
                  </span>
                )}
              </div>

              {/* Stats Grid with Loading Skeleton */}
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="rounded-2xl border border-emerald-900/40 bg-[#091711]/80 p-5 animate-pulse">
                      <div className="flex items-center justify-between mb-3">
                        <div className="h-3 w-20 bg-emerald-900/40 rounded" />
                        <div className="w-8 h-8 rounded-lg bg-emerald-900/40" />
                      </div>
                      <div className="h-7 w-24 bg-emerald-900/40 rounded" />
                      <div className="h-3 w-16 bg-emerald-900/40 rounded mt-1" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Address Card */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="group rounded-2xl border border-emerald-900/40 bg-[#091711]/80 hover:bg-[#0c1f17]/90 p-5 transition-all duration-200 hover:border-emerald-500/40 shadow-[0_4px_20px_rgba(0,0,0,0.3)] cursor-default">
                        <div className="flex items-center justify-between text-emerald-100/60 mb-3">
                          <span className="text-xs uppercase font-medium tracking-wider">Wallet Address</span>
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                            <Wallet className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="text-lg font-mono font-bold text-white tracking-tight">
                          {address.slice(0, 6)}...{address.slice(-4)}
                        </div>
                        <div className="text-xs text-emerald-400/80 mt-1 flex items-center gap-1">
                          <span>Active on {data.chainName || 'Mainnet'}</span>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Full wallet address: {address}</p>
                    </TooltipContent>
                  </Tooltip>

                  {/* Transactions Card */}
                  <div className="group rounded-2xl border border-emerald-900/40 bg-[#091711]/80 hover:bg-[#0c1f17]/90 p-5 transition-all duration-200 hover:border-emerald-500/40 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                    <div className="flex items-center justify-between text-emerald-100/60 mb-3">
                      <span className="text-xs uppercase font-medium tracking-wider">Total Transactions</span>
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                        <Activity className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-white tracking-tight">
                      {data.transactions?.length || 0}
                    </div>
                    <div className="text-xs text-emerald-400/70 mt-1">Confirmed on-chain</div>
                  </div>

                  {/* Tokens Card */}
                  <div className="group rounded-2xl border border-emerald-900/40 bg-[#091711]/80 hover:bg-[#0c1f17]/90 p-5 transition-all duration-200 hover:border-emerald-500/40 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                    <div className="flex items-center justify-between text-emerald-100/60 mb-3">
                      <span className="text-xs uppercase font-medium tracking-wider">Tracked Tokens</span>
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                        <Coins className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-white tracking-tight">
                      {data.tokens?.length || 0}
                    </div>
                    <div className="text-xs text-emerald-400/70 mt-1">Holdings detected</div>
                  </div>

                  {/* Native Balance Card */}
                  <div className="group rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-[#0c2219]/90 to-[#071610]/90 p-5 transition-all duration-200 hover:border-emerald-400/60 shadow-[0_0_25px_rgba(16,185,129,0.15)]">
                    <div className="flex items-center justify-between text-emerald-100/60 mb-3">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs uppercase font-medium tracking-wider cursor-help">
                            Balance ({data.symbol || 'ETH'})
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Total native token balance</p>
                        </TooltipContent>
                      </Tooltip>
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-300">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-emerald-300 tracking-tight">
                      {(data.balance || 0).toFixed(4)} <span className="text-sm font-normal text-emerald-400/80">{data.symbol || 'ETH'}</span>
                    </div>
                    <div className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-950/70 px-2 py-0.5 rounded-full border border-emerald-500/30 mt-1">
                      <ArrowUpRight className="w-3 h-3" />
                      <span>+2.5% (24h)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 8-Tab Navigation Bar */}
              <div className="flex flex-wrap gap-1.5 p-1.5 bg-[#07140e] rounded-2xl border border-emerald-900/50 backdrop-blur-md shadow-inner">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 min-w-[70px] sm:min-w-[100px] flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-medium rounded-xl transition-all duration-200 ${
                        isActive
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold shadow-[0_0_20px_rgba(16,185,129,0.35)] border border-emerald-400/40'
                          : 'text-emerald-100/60 hover:text-emerald-200 hover:bg-[#0b2017]/50 border border-transparent'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="hidden sm:inline">{tab.label}</span>
                      <span className="sm:hidden">{tab.label.charAt(0)}</span>
                      {tab.id === 'scanner' && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                      )}
                      {tab.id === 'nfts' && hasNFTs && (
                        <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                      )}
                      {tab.id === 'copy-trading' && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tab Views */}
              <div className="space-y-6">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <>
                    {/* Main Grid - Chart and Live Prices */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2 rounded-2xl border border-emerald-900/40 bg-[#091711]/90 p-6 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-emerald-900/30">
                          <div>
                            <h3 className="text-base font-bold text-white">Portfolio Value Trend</h3>
                            <p className="text-xs text-emerald-100/50">30-day cumulative value performance</p>
                          </div>
                          <span className="text-xs text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-500/20">
                            USD Valued
                          </span>
                        </div>
                        <div className="min-h-[260px]">
                          <PortfolioChart data={chartData} isLoading={loading} />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-emerald-900/40 bg-[#091711]/90 p-6 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-emerald-900/30">
                          <h3 className="text-base font-bold text-white">Live Market Prices</h3>
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        </div>
                        <LivePrices chain={data?.chain || 'ethereum'} tokens={data?.tokens || []} />
                      </div>
                    </div>

                    {/* Lower Grid - Token Holdings & Transactions */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="rounded-2xl border border-emerald-900/40 bg-[#091711]/90 p-6 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-emerald-900/30">
                          <div>
                            <h3 className="text-base font-bold text-white">Token Holdings</h3>
                            <p className="text-xs text-emerald-100/50">{data.tokens?.length || 0} Assets detected</p>
                          </div>
                        </div>
                        <TokenHoldings tokens={data.tokens || []} chain={data?.chain || 'ethereum'} />
                      </div>

                      <div className="rounded-2xl border border-emerald-900/40 bg-[#091711]/90 p-6 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-emerald-900/30">
                          <div>
                            <h3 className="text-base font-bold text-white">Recent Transactions</h3>
                            <p className="text-xs text-emerald-100/50">{data.transactions?.length || 0} Total logs</p>
                          </div>
                        </div>
                        <RecentTransactions transactions={data.transactions || []} />
                      </div>
                    </div>

                    {/* Asset Allocation */}
                    <div className="rounded-2xl border border-emerald-900/40 bg-[#091711]/90 p-6 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
                      <div className="flex items-center justify-between mb-4 pb-3 border-b border-emerald-900/30">
                        <h3 className="text-base font-bold text-white">Asset Allocation</h3>
                        <span className="text-xs text-emerald-400/80">Diversification metrics</span>
                      </div>
                      <AssetAllocation allocation={allocation} isLoading={loading} />
                    </div>
                  </>
                )}

                {/* Tokens Tab */}
                {activeTab === 'tokens' && (
                  <div className="rounded-2xl border border-emerald-900/40 bg-[#091711]/90 p-6 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
                    <div className="mb-4 pb-3 border-b border-emerald-900/30">
                      <h3 className="text-base font-bold text-white">All Token Holdings</h3>
                      <p className="text-xs text-emerald-100/50">Comprehensive token balances & portfolio share</p>
                    </div>
                    <TokenHoldings tokens={data.tokens || []} chain={data?.chain || 'ethereum'} />
                  </div>
                )}

                {/* NFTs Tab */}
                {activeTab === 'nfts' && (
                  <div className="space-y-6">
                    <div className="rounded-2xl border border-emerald-900/40 bg-[#091711]/90 p-6 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
                      <NFTStats address={address} chain={data?.chain || 'ethereum'} />
                    </div>
                    <div className="rounded-2xl border border-emerald-900/40 bg-[#091711]/90 p-6 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
                      <NFTGallery address={address} chain={data?.chain || 'ethereum'} />
                    </div>
                  </div>
                )}

                {/* History Tab */}
                {activeTab === 'history' && (
                  <div className="rounded-2xl border border-emerald-900/40 bg-[#091711]/90 p-6 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
                    <div className="mb-4 pb-3 border-b border-emerald-900/30">
                      <h3 className="text-base font-bold text-white">Portfolio History</h3>
                      <p className="text-xs text-emerald-100/50">Chronological transaction and value log</p>
                    </div>
                    <PortfolioHistory address={address} chain={data?.chain || 'ethereum'} />
                  </div>
                )}

                {/* Scanner Tab */}
                {activeTab === 'scanner' && (
                  <div className="rounded-2xl border border-emerald-900/40 bg-[#091711]/90 p-6 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
                    <ScannerDashboard />
                  </div>
                )}

                {/* Copy-Trading Tab */}
                {activeTab === 'copy-trading' && (
                  <div className="rounded-2xl border border-emerald-900/40 bg-[#091711]/90 p-6 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-emerald-900/30">
                      <div>
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                          <Bell className="w-5 h-5 text-amber-400" />
                          Copy-Trading Alerts
                        </h3>
                        <p className="text-xs text-emerald-100/50 mt-0.5">
                          Real-time webhook notifications and whale wallet trade alerts
                        </p>
                      </div>
                      <span className="self-start sm:self-auto text-xs px-3 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-full flex items-center gap-1.5 shadow-[0_0_12px_rgba(251,191,36,0.15)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Live Webhook Engine
                      </span>
                    </div>
                    <CopyTradeAlerts />
                  </div>
                )}

                {/* PnL Tab */}
                {activeTab === 'pnl' && (
                  <div className="rounded-2xl border border-emerald-900/40 bg-[#091711]/90 p-6 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
                    <div className="mb-6 pb-3 border-b border-emerald-900/30">
                      <h3 className="text-base font-bold text-white">Profit & Loss Analysis</h3>
                      <p className="text-xs text-emerald-100/50">Performance metrics calculated from realized on-chain trades</p>
                    </div>
                    {pnlData ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Total PnL */}
                        <div
                          className={`p-5 rounded-xl border ${
                            pnlData.isProfitable
                              ? 'bg-emerald-950/40 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
                              : 'bg-rose-950/40 border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.1)]'
                          }`}
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-xs font-medium uppercase tracking-wider text-emerald-100/60 cursor-help">Total Net PnL</p>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Total realized profit/loss from all trades</p>
                            </TooltipContent>
                          </Tooltip>
                          <p
                            className={`text-2xl font-bold mt-1 ${
                              pnlData.isProfitable ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {pnlData.totalPnL > 0 ? '+' : ''}
                            {pnlData.totalPnL.toFixed(4)} ETH
                          </p>
                        </div>

                        {/* ROI */}
                        <div className="p-5 bg-[#0a1f15]/80 border border-emerald-900/60 rounded-xl">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-xs font-medium uppercase tracking-wider text-emerald-100/60 cursor-help">Total ROI</p>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Return on investment percentage</p>
                            </TooltipContent>
                          </Tooltip>
                          <p
                            className={`text-2xl font-bold mt-1 ${
                              pnlData.totalRoi >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {pnlData.totalRoi > 0 ? '+' : ''}
                            {pnlData.totalRoi.toFixed(2)}%
                          </p>
                        </div>

                        {/* Win Rate */}
                        <div className="p-5 bg-[#0a1f15]/80 border border-emerald-900/60 rounded-xl">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-xs font-medium uppercase tracking-wider text-emerald-100/60 cursor-help">Win Rate</p>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Percentage of profitable trades</p>
                            </TooltipContent>
                          </Tooltip>
                          <p className="text-2xl font-bold text-teal-300 mt-1">
                            {pnlData.winRate.toFixed(1)}%
                          </p>
                        </div>

                        {/* Wins */}
                        <div className="p-5 bg-[#0a1f15]/80 border border-emerald-900/60 rounded-xl">
                          <p className="text-xs font-medium uppercase tracking-wider text-emerald-100/60">Profitable Trades</p>
                          <p className="text-2xl font-bold text-emerald-400 mt-1">{pnlData.winCount}</p>
                        </div>

                        {/* Losses */}
                        <div className="p-5 bg-[#0a1f15]/80 border border-emerald-900/60 rounded-xl">
                          <p className="text-xs font-medium uppercase tracking-wider text-emerald-100/60">Loss Trades</p>
                          <p className="text-2xl font-bold text-rose-400 mt-1">{pnlData.lossCount}</p>
                        </div>

                        {/* Total Transactions */}
                        <div className="p-5 bg-[#0a1f15]/80 border border-emerald-900/60 rounded-xl">
                          <p className="text-xs font-medium uppercase tracking-wider text-emerald-100/60">Analyzed Trades</p>
                          <p className="text-2xl font-bold text-white mt-1">{pnlData.totalTransactions}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-center text-emerald-100/50 py-10">
                        No transaction data available for PnL calculation.
                      </p>
                    )}
                  </div>
                )}

                {/* Wallets Management Tab */}
                {activeTab === 'wallets' && (
                  <div className="rounded-2xl border border-emerald-900/40 bg-[#091711]/90 p-6 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-emerald-900/30">
                      <div>
                        <h3 className="text-base font-bold text-white">Wallet Management</h3>
                        <p className="text-xs text-emerald-100/50">Manage saved tracked wallets and custom labels</p>
                      </div>
                      <ExportButton type="holdings" label="Export All" variant="outline" />
                    </div>
                    <WalletManagement />
                  </div>
                )}
              </div>

              {/* Bottom Quick Network Specs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                <div className="rounded-xl border border-emerald-900/30 bg-[#081711]/60 p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-emerald-100/50 uppercase font-medium">Network</div>
                    <div className="text-sm font-semibold text-white">{data.chainName || 'Ethereum'}</div>
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-900/30 bg-[#081711]/60 p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-emerald-100/50 uppercase font-medium">Total Assets</div>
                    <div className="text-sm font-semibold text-white">{data.tokens?.length || 0} Assets</div>
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-900/30 bg-[#081711]/60 p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <ArrowUpRight className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-emerald-100/50 uppercase font-medium">Activity</div>
                    <div className="text-sm font-semibold text-white">{data.transactions?.length || 0} Transfers</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </TooltipProvider>
  );
}