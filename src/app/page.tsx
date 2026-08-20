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
} from 'lucide-react';

// Shadcn/ui imports
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

// Component imports
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
import ScannerDashboard from '@/components/scanner/ScannerDashboard'; // ✅ Added Scanner import

// Enterprise-grade tab configuration
const TAB_CONFIG = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'tokens', label: 'Tokens', icon: Coins },
  { id: 'nfts', label: 'NFTs', icon: Image },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'scanner', label: 'Scanner', icon: Target, badge: true, badgeColor: 'bg-green-500' },
] as const;

type TabId = typeof TAB_CONFIG[number]['id'];

export default function Home() {
  // State management
  const [address, setAddress] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<{ date: string; value: number }[]>([]);
  const [allocation, setAllocation] = useState<{ name: string; value: number; color: string }[]>([]);
  const [showNFTs, setShowNFTs] = useState(true);
  const [hasNFTs, setHasNFTs] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

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

  // Handle wallet address submission
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

  // Memoized tab badge configuration
  const tabsWithBadges = useMemo(() => {
    return TAB_CONFIG.map(tab => ({
      ...tab,
      showBadge: tab.id === 'nfts' ? hasNFTs : tab.badge,
    }));
  }, [hasNFTs]);

  // Stats grid configuration
  const statsConfig = useMemo(() => [
    { 
      id: 'address',
      label: 'Wallet Address',
      value: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'N/A',
      icon: Wallet,
    },
    {
      id: 'transactions',
      label: 'Transactions',
      value: data?.transactions?.length || 0,
      icon: Activity,
    },
    {
      id: 'tokens',
      label: 'Tokens',
      value: data?.tokens?.length || 0,
      icon: Coins,
    },
    {
      id: 'balance',
      label: `Balance (${data?.chainName || 'Ethereum'})`,
      value: `${(data?.balance || 0).toFixed(4)} ${data?.symbol || 'ETH'}`,
      icon: TrendingUp,
      change: '+2.5%',
    },
  ], [address, data]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              CRYPTO WALLET TRACKER
            </h1>
            <p className="text-sm text-muted-foreground">
              Track balances, tokens, transactions, and portfolio activities.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="default" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse mr-1.5" />
              Live
            </Badge>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Wallet Input Section */}
        <section className="max-w-2xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto p-3 bg-primary/10 rounded-full w-fit mb-4">
                <Wallet className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Track a wallet</CardTitle>
              <CardDescription>
                Enter a wallet address to view its portfolio and activity.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <WalletInput onAddressSubmit={handleAddressSubmit} isLoading={loading} />
              <p className="text-xs text-center text-muted-foreground">
                Supports: Ethereum, Polygon, BSC, Arbitrum, Optimism, Avalanche, Base
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center py-8">
            <Card className="w-full max-w-md">
              <CardContent className="flex items-center gap-4 py-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <div>
                  <p className="font-semibold">Loading wallet data</p>
                  <p className="text-sm text-muted-foreground">
                    Fetching balances and transactions...
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="flex justify-center py-4">
            <Card className="w-full max-w-2xl border-destructive/50 bg-destructive/10">
              <CardContent className="flex items-start gap-3 py-6">
                <AlertCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
                <div>
                  <p className="font-semibold text-destructive">Unable to load wallet</p>
                  <p className="text-sm text-destructive/80">{error}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Dashboard Content */}
        {data && !loading && (
          <>
            {/* Overview Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-6 w-6 text-primary" />
                <h2 className="text-xl font-semibold">WALLET OVERVIEW</h2>
              </div>
              {data.chainName && (
                <Badge variant="secondary">{data.chainName}</Badge>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {statsConfig.map((stat) => {
                const Icon = stat.icon;
                return (
                  <Card key={stat.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Icon className="h-4 w-4" />
                        <span className="text-sm">{stat.label}</span>
                      </div>
                      <p className="text-2xl font-bold mt-2">{stat.value}</p>
                      {stat.change && (
                        <Badge variant="default" className="mt-2 bg-green-500/10 text-green-600 dark:text-green-400">
                          {stat.change}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Enterprise Tabs */}
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabId)} className="space-y-6">
              <TabsList className="flex flex-wrap gap-1 p-1 bg-muted/50 rounded-xl border border-border h-auto min-h-[48px]">
                {tabsWithBadges.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  
                  return (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className={`
                        flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200
                        data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm
                        data-[state=active]:ring-1 data-[state=active]:ring-primary/20
                        hover:bg-muted/50
                        flex-1 sm:flex-none min-w-[60px]
                      `}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="hidden sm:inline">{tab.label}</span>
                      <span className="sm:hidden">{tab.label.charAt(0)}</span>
                      
                      {tab.showBadge && (
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0",
                          tab.badgeColor || "bg-primary"
                        )} />
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                {/* Main Grid - Chart and Prices */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        Portfolio Value
                        <span className="text-sm font-normal text-muted-foreground ml-2">
                          (30 days Value Performance)
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <PortfolioChart data={chartData} isLoading={loading} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Live Price</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <LivePrices chain={data?.chain || 'ethereum'} tokens={data?.tokens || []} />
                    </CardContent>
                  </Card>
                </div>

                {/* NFT Gallery (Collapsible in Overview) */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                          <Image className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <CardTitle>NFT Gallery</CardTitle>
                          {hasNFTs && (
                            <CardDescription className="flex items-center gap-1">
                              <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded-full">
                                🟢 {data.chainName || 'Ethereum'}
                              </span>
                            </CardDescription>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setShowNFTs(!showNFTs)}
                        className="text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition-colors"
                      >
                        {showNFTs ? 'Hide' : 'Show'} NFTs
                      </button>
                    </div>
                  </CardHeader>
                  {showNFTs && (
                    <CardContent className="space-y-4">
                      <NFTStats address={address} chain={data?.chain || 'ethereum'} />
                      <NFTGallery address={address} chain={data?.chain || 'ethereum'} />
                    </CardContent>
                  )}
                </Card>

                {/* Lower Grid - Holdings and Transactions */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Token Holdings</CardTitle>
                      <CardDescription>{data.tokens?.length || 0} Assets</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <TokenHoldings tokens={data.tokens || []} chain={data?.chain || 'ethereum'} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Recent Transactions</CardTitle>
                      <CardDescription>{data.transactions?.length || 0} total</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <RecentTransactions transactions={data.transactions || []} />
                    </CardContent>
                  </Card>
                </div>

                {/* Asset Allocation */}
                <Card>
                  <CardHeader>
                    <CardTitle>Asset Allocation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <AssetAllocation allocation={allocation} isLoading={loading} />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tokens Tab */}
              <TabsContent value="tokens">
                <Card>
                  <CardHeader>
                    <CardTitle>Token Holdings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TokenHoldings tokens={data.tokens || []} chain={data?.chain || 'ethereum'} />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* NFTs Tab */}
              <TabsContent value="nfts">
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>NFT Statistics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <NFTStats address={address} chain={data?.chain || 'ethereum'} />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>NFT Gallery</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <NFTGallery address={address} chain={data?.chain || 'ethereum'} />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* History Tab */}
              <TabsContent value="history">
                <Card>
                  <CardHeader>
                    <CardTitle>Portfolio History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PortfolioHistory address={address} chain={data?.chain || 'ethereum'} />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ✅ Scanner Tab - Updated with ScannerDashboard component */}
              <TabsContent value="scanner">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Wallet Scanner</CardTitle>
                      <Badge variant="default" className="bg-green-500/10 text-green-600 dark:text-green-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse mr-1.5" />
                        Live
                      </Badge>
                    </div>
                    <CardDescription>
                      Scan wallets for smart money, whale activity, and trading patterns
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScannerDashboard /> {/* ✅ Now using the actual ScannerDashboard component */}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Bottom Grid */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="mx-auto w-fit p-2 bg-muted rounded-lg mb-2">
                    <Activity className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">Network</p>
                  <p className="font-semibold">{data.chainName || 'Ethereum'}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="mx-auto w-fit p-2 bg-muted rounded-lg mb-2">
                    <Coins className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">Assets</p>
                  <p className="font-semibold">{data.tokens?.length || 0}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="mx-auto w-fit p-2 bg-muted rounded-lg mb-2">
                    <ArrowUpRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">Transactions</p>
                  <p className="font-semibold">{data.transactions?.length || 0}</p>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// Utility function for conditional classes (if not already in utils.ts)
function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}