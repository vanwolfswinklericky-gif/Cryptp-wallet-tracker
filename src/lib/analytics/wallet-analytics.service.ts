// src/lib/analytics/wallet-analytics.service.ts
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

export interface WalletAnalytics {
  // Performance metrics
  pnl: {
    total: number;
    realized: number;
    unrealized: number;
    daily: number[];
    weekly: number[];
    monthly: number[];
  };
  roi: {
    total: number;
    byToken: Record<string, number>;
    byChain: Record<string, number>;
  };
  winRate: {
    overall: number;
    byToken: Record<string, number>;
    byChain: Record<string, number>;
    byTimeframe: {
      day: number;
      week: number;
      month: number;
    };
  };
  
  // Risk metrics
  drawdown: {
    max: number;
    current: number;
    average: number;
    recoveryTime: number;
  };
  
  // Trading behavior
  tradingFrequency: {
    daily: number;
    weekly: number;
    monthly: number;
    average: number;
  };
  averageHoldingPeriod: {
    overall: number;
    byToken: Record<string, number>;
  };
  averagePositionSize: {
    overall: number;
    byToken: Record<string, number>;
  };
  
  // Concentration
  tokenConcentration: {
    herfindahlIndex: number;
    topHoldings: Array<{ token: string; percentage: number }>;
    nftConcentration: number;
  };
  
  // Consistency
  consistency: {
    score: number;
    monthlyPerformance: number[];
    streak: number;
    volatility: number;
  };
  
  // Behavior patterns
  earlyEntryBehavior: {
    score: number;
    earlyEntries: number;
    averageEntryTime: number;
  };
  accumulationBehavior: {
    score: number;
    accumulationWallets: number;
    averageAccumulation: number;
  };
  
  // Preferences
  chainPreference: Record<string, number>;
  protocolPreference: Record<string, number>;
  tokenPreference: string[];
  
  // Smart money
  smartMoneyScore: number;
  walletScore: number;
  profitabilityScore: number;
}

export class WalletAnalyticsService {
  private static instance: WalletAnalyticsService;

  static getInstance(): WalletAnalyticsService {
    if (!WalletAnalyticsService.instance) {
      WalletAnalyticsService.instance = new WalletAnalyticsService();
    }
    return WalletAnalyticsService.instance;
  }

  /**
   * ✅ Calculate complete analytics for a wallet
   */
  async calculateAnalytics(walletId: string): Promise<WalletAnalytics | null> {
    try {
      // Fetch wallet data
      const wallet = await prisma.wallet.findUnique({
        where: { id: walletId },
        include: {
          transactions: {
            orderBy: { timestamp: 'desc' },
          },
          metrics: {
            orderBy: { timestamp: 'desc' },
            take: 30,
          },
        },
      });

      if (!wallet) return null;

      const transactions = wallet.transactions || [];
      const metrics = wallet.metrics || [];

      // Calculate all metrics
      const pnl = this.calculatePnL(transactions);
      const roi = this.calculateROI(transactions);
      const winRate = this.calculateWinRate(transactions);
      const drawdown = this.calculateDrawdown(transactions);
      const tradingFrequency = this.calculateTradingFrequency(transactions);
      const averageHoldingPeriod = this.calculateAverageHoldingPeriod(transactions);
      const averagePositionSize = this.calculateAveragePositionSize(transactions);
      const tokenConcentration = this.calculateTokenConcentration(transactions);
      const consistency = this.calculateConsistency(transactions, metrics);
      const earlyEntryBehavior = this.calculateEarlyEntryBehavior(transactions);
      const accumulationBehavior = this.calculateAccumulationBehavior(transactions);
      const chainPreference = this.calculateChainPreference(transactions);
      const protocolPreference = this.calculateProtocolPreference(transactions);
      const tokenPreference = this.calculateTokenPreference(transactions);

      // Calculate scores
      const profitabilityScore = this.calculateProfitabilityScore(pnl, roi, winRate);
      const smartMoneyScore = this.calculateSmartMoneyScore({
        winRate: winRate.overall,
        drawdown: drawdown.max,
        consistency: consistency.score,
        earlyEntryBehavior: earlyEntryBehavior.score,
        accumulationBehavior: accumulationBehavior.score,
      });
      const walletScore = this.calculateWalletScore({
        pnl: pnl.total,
        roi: roi.total,
        winRate: winRate.overall,
        consistency: consistency.score,
        smartMoneyScore,
      });

      return {
        pnl,
        roi,
        winRate,
        drawdown,
        tradingFrequency,
        averageHoldingPeriod,
        averagePositionSize,
        tokenConcentration,
        consistency,
        earlyEntryBehavior,
        accumulationBehavior,
        chainPreference,
        protocolPreference,
        tokenPreference,
        smartMoneyScore,
        walletScore,
        profitabilityScore,
      };
    } catch (error) {
      logger.error('Analytics calculation failed:', error);
      return null;
    }
  }

  /**
   * ✅ Calculate PnL (Profit and Loss)
   */
  private calculatePnL(transactions: any[]): any {
    let totalPnL = 0;
    let realizedPnL = 0;
    let unrealizedPnL = 0;
    const daily: number[] = [];
    const weekly: number[] = [];
    const monthly: number[] = [];

    const groupedByDay: Record<string, number> = {};
    const groupedByWeek: Record<string, number> = {};
    const groupedByMonth: Record<string, number> = {};

    transactions.forEach(tx => {
      const value = tx.valueUsd || 0;
      const isBuy = tx.transactionType === 'BUY';
      
      if (isBuy) {
        totalPnL -= value;
      } else {
        totalPnL += value;
      }

      // Group by day
      const day = tx.timestamp.toISOString().split('T')[0];
      groupedByDay[day] = (groupedByDay[day] || 0) + (isBuy ? -value : value);
    });

    // Convert to arrays
    Object.values(groupedByDay).forEach(v => daily.push(v));
    
    // Calculate realized vs unrealized (simplified)
    realizedPnL = totalPnL * 0.7; // Approximation
    unrealizedPnL = totalPnL * 0.3;

    return {
      total: totalPnL,
      realized: realizedPnL,
      unrealized: unrealizedPnL,
      daily: daily.slice(-30),
      weekly: weekly.slice(-52),
      monthly: monthly.slice(-12),
    };
  }

  /**
   * ✅ Calculate ROI (Return on Investment)
   */
  private calculateROI(transactions: any[]): any {
    let totalInvested = 0;
    let totalReturned = 0;
    const byToken: Record<string, number> = {};
    const byChain: Record<string, number> = {};

    transactions.forEach(tx => {
      const value = tx.valueUsd || 0;
      const isBuy = tx.transactionType === 'BUY';
      
      if (isBuy) {
        totalInvested += value;
        if (tx.tokenSymbol) {
          byToken[tx.tokenSymbol] = (byToken[tx.tokenSymbol] || 0) - value;
        }
        if (tx.chain) {
          byChain[tx.chain] = (byChain[tx.chain] || 0) - value;
        }
      } else {
        totalReturned += value;
        if (tx.tokenSymbol) {
          byToken[tx.tokenSymbol] = (byToken[tx.tokenSymbol] || 0) + value;
        }
        if (tx.chain) {
          byChain[tx.chain] = (byChain[tx.chain] || 0) + value;
        }
      }
    });

    const totalROI = totalInvested > 0 ? (totalReturned - totalInvested) / totalInvested * 100 : 0;

    // Calculate per token ROI
    Object.keys(byToken).forEach(token => {
      const invested = Math.abs(byToken[token]);
      byToken[token] = invested > 0 ? (byToken[token] / invested) * 100 : 0;
    });

    Object.keys(byChain).forEach(chain => {
      const invested = Math.abs(byChain[chain]);
      byChain[chain] = invested > 0 ? (byChain[chain] / invested) * 100 : 0;
    });

    return {
      total: totalROI,
      byToken,
      byChain,
    };
  }

  /**
   * ✅ Calculate Win Rate
   */
  private calculateWinRate(transactions: any[]): any {
    const wins = transactions.filter(tx => tx.transactionType === 'SELL' && (tx.valueUsd || 0) > 0);
    const losses = transactions.filter(tx => tx.transactionType === 'SELL' && (tx.valueUsd || 0) < 0);
    const total = wins.length + losses.length;

    const byToken: Record<string, { wins: number; losses: number }> = {};
    const byChain: Record<string, { wins: number; losses: number }> = {};

    transactions.forEach(tx => {
      if (tx.transactionType !== 'SELL') return;
      
      const isWin = (tx.valueUsd || 0) > 0;
      if (tx.tokenSymbol) {
        if (!byToken[tx.tokenSymbol]) byToken[tx.tokenSymbol] = { wins: 0, losses: 0 };
        if (isWin) byToken[tx.tokenSymbol].wins++;
        else byToken[tx.tokenSymbol].losses++;
      }
      if (tx.chain) {
        if (!byChain[tx.chain]) byChain[tx.chain] = { wins: 0, losses: 0 };
        if (isWin) byChain[tx.chain].wins++;
        else byChain[tx.chain].losses++;
      }
    });

    // Calculate per token win rate
    Object.keys(byToken).forEach(token => {
      const total = byToken[token].wins + byToken[token].losses;
      byToken[token] = total > 0 ? (byToken[token].wins / total) * 100 : 0;
    });

    Object.keys(byChain).forEach(chain => {
      const total = byChain[chain].wins + byChain[chain].losses;
      byChain[chain] = total > 0 ? (byChain[chain].wins / total) * 100 : 0;
    });

    return {
      overall: total > 0 ? (wins.length / total) * 100 : 0,
      byToken,
      byChain,
      byTimeframe: {
        day: 0, // Would require more complex calculation
        week: 0,
        month: 0,
      },
    };
  }

  /**
   * ✅ Calculate Drawdown
   */
  private calculateDrawdown(transactions: any[]): any {
    let peak = 0;
    let maxDrawdown = 0;
    let currentDrawdown = 0;
    let totalDrawdown = 0;
    let drawdownCount = 0;
    let recoveryTime = 0;

    let balance = 0;
    const balances: number[] = [];

    transactions.forEach(tx => {
      balance += tx.valueUsd || 0;
      balances.push(balance);
      
      if (balance > peak) {
        peak = balance;
        if (currentDrawdown > 0) {
          // Recovery occurred
          drawdownCount++;
        }
        currentDrawdown = 0;
      } else {
        currentDrawdown = peak > 0 ? (peak - balance) / peak * 100 : 0;
        if (currentDrawdown > maxDrawdown) {
          maxDrawdown = currentDrawdown;
        }
        totalDrawdown += currentDrawdown;
        recoveryTime++;
      }
    });

    return {
      max: maxDrawdown,
      current: currentDrawdown,
      average: drawdownCount > 0 ? totalDrawdown / drawdownCount : 0,
      recoveryTime,
    };
  }

  /**
   * ✅ Calculate Trading Frequency
   */
  private calculateTradingFrequency(transactions: any[]): any {
    if (transactions.length === 0) {
      return { daily: 0, weekly: 0, monthly: 0, average: 0 };
    }

    const firstTx = transactions[transactions.length - 1];
    const lastTx = transactions[0];
    const daysActive = Math.max(1, (lastTx.timestamp.getTime() - firstTx.timestamp.getTime()) / (1000 * 60 * 60 * 24));

    const totalTrades = transactions.length;
    const daily = totalTrades / daysActive;
    const weekly = daily * 7;
    const monthly = daily * 30;

    return {
      daily,
      weekly,
      monthly,
      average: daily,
    };
  }

  /**
   * ✅ Calculate Average Holding Period
   */
  private calculateAverageHoldingPeriod(transactions: any[]): any {
    const buys: any[] = [];
    const sells: any[] = [];
    const byToken: Record<string, number[]> = {};

    transactions.forEach(tx => {
      if (tx.transactionType === 'BUY') {
        buys.push(tx);
        if (tx.tokenSymbol) {
          if (!byToken[tx.tokenSymbol]) byToken[tx.tokenSymbol] = [];
          byToken[tx.tokenSymbol].push(tx.timestamp.getTime());
        }
      } else if (tx.transactionType === 'SELL') {
        sells.push(tx);
        if (tx.tokenSymbol) {
          // Simple matching: match sells with buys
          if (byToken[tx.tokenSymbol] && byToken[tx.tokenSymbol].length > 0) {
            const buyTime = byToken[tx.tokenSymbol].shift();
            if (buyTime) {
              const holdTime = (tx.timestamp.getTime() - buyTime) / (1000 * 60 * 60 * 24);
              if (!byToken[tx.tokenSymbol + '_hold']) {
                byToken[tx.tokenSymbol + '_hold'] = [];
              }
              byToken[tx.tokenSymbol + '_hold'].push(holdTime);
            }
          }
        }
      }
    });

    // Calculate average holding period overall
    const allHoldTimes: number[] = [];
    Object.keys(byToken).forEach(key => {
      if (key.endsWith('_hold')) {
        allHoldTimes.push(...byToken[key]);
      }
    });

    const overall = allHoldTimes.length > 0 ? allHoldTimes.reduce((a, b) => a + b, 0) / allHoldTimes.length : 0;

    // Per token average
    const byTokenResult: Record<string, number> = {};
    Object.keys(byToken).forEach(key => {
      if (key.endsWith('_hold')) {
        const tokenName = key.replace('_hold', '');
        const times = byToken[key];
        byTokenResult[tokenName] = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
      }
    });

    return {
      overall,
      byToken: byTokenResult,
    };
  }

  /**
   * ✅ Calculate Average Position Size
   */
  private calculateAveragePositionSize(transactions: any[]): any {
    const byToken: Record<string, number[]> = {};

    transactions.forEach(tx => {
      if (tx.transactionType === 'BUY' && tx.tokenSymbol) {
        if (!byToken[tx.tokenSymbol]) byToken[tx.tokenSymbol] = [];
        byToken[tx.tokenSymbol].push(tx.amount || 0);
      }
    });

    let total = 0;
    let count = 0;
    const byTokenResult: Record<string, number> = {};

    Object.keys(byToken).forEach(token => {
      const positions = byToken[token];
      const avg = positions.reduce((a, b) => a + b, 0) / positions.length;
      byTokenResult[token] = avg;
      total += avg;
      count++;
    });

    return {
      overall: count > 0 ? total / count : 0,
      byToken: byTokenResult,
    };
  }

  /**
   * ✅ Calculate Token Concentration (Herfindahl-Hirschman Index)
   */
  private calculateTokenConcentration(transactions: any[]): any {
    const tokenValues: Record<string, number> = {};
    let totalValue = 0;

    transactions.forEach(tx => {
      const value = Math.abs(tx.valueUsd || 0);
      if (tx.tokenSymbol) {
        tokenValues[tx.tokenSymbol] = (tokenValues[tx.tokenSymbol] || 0) + value;
        totalValue += value;
      }
    });

    // Calculate HHI (sum of squared market shares)
    let hhi = 0;
    const topHoldings: Array<{ token: string; percentage: number }> = [];

    Object.keys(tokenValues).forEach(token => {
      const percentage = totalValue > 0 ? (tokenValues[token] / totalValue) * 100 : 0;
      hhi += percentage * percentage;
      topHoldings.push({ token, percentage });
    });

    // Sort by percentage descending
    topHoldings.sort((a, b) => b.percentage - a.percentage);

    // HHI ranges: < 0.15 = diversified, 0.15-0.25 = moderately concentrated, > 0.25 = highly concentrated
    const hhiIndex = hhi / 10000;

    return {
      herfindahlIndex: hhiIndex,
      topHoldings: topHoldings.slice(0, 10),
      nftConcentration: 0, // Would require NFT-specific data
    };
  }

  /**
   * ✅ Calculate Consistency Score
   */
  private calculateConsistency(transactions: any[], metrics: any[]): any {
    // Calculate monthly performance
    const monthlyPerformance: number[] = [];
    const monthlyPnL: Record<string, number> = {};

    transactions.forEach(tx => {
      const month = tx.timestamp.toISOString().slice(0, 7);
      monthlyPnL[month] = (monthlyPnL[month] || 0) + (tx.valueUsd || 0);
    });

    Object.values(monthlyPnL).forEach(pnl => {
      monthlyPerformance.push(pnl);
    });

    // Calculate consistency score
    const positiveMonths = monthlyPerformance.filter(p => p > 0).length;
    const totalMonths = monthlyPerformance.length;
    const winRate = totalMonths > 0 ? positiveMonths / totalMonths : 0;

    // Calculate volatility (standard deviation of monthly returns)
    const avg = monthlyPerformance.reduce((a, b) => a + b, 0) / (monthlyPerformance.length || 1);
    const variance = monthlyPerformance.reduce((a, b) => a + (b - avg) * (b - avg), 0) / (monthlyPerformance.length || 1);
    const volatility = Math.sqrt(variance);

    // Streak (consecutive positive months)
    let currentStreak = 0;
    let maxStreak = 0;
    for (const pnl of monthlyPerformance) {
      if (pnl > 0) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    // Consistency score combines win rate, volatility, and streak
    const score = (winRate * 50) + (Math.max(0, 100 - volatility) * 0.3) + (Math.min(20, maxStreak * 5));

    return {
      score: Math.min(100, score),
      monthlyPerformance,
      streak: maxStreak,
      volatility,
    };
  }

  /**
   * ✅ Calculate Early Entry Behavior
   */
  private calculateEarlyEntryBehavior(transactions: any[]): any {
    // Find early entries (first 10% of transactions in a token's lifecycle)
    const tokenFirstTxs: Record<string, number[]> = {};
    const earlyEntries: number[] = [];

    transactions.forEach(tx => {
      if (tx.tokenSymbol && tx.transactionType === 'BUY') {
        if (!tokenFirstTxs[tx.tokenSymbol]) {
          tokenFirstTxs[tx.tokenSymbol] = [];
        }
        tokenFirstTxs[tx.tokenSymbol].push(tx.timestamp.getTime());
      }
    });

    Object.keys(tokenFirstTxs).forEach(token => {
      const txs = tokenFirstTxs[token].sort((a, b) => a - b);
      const earlyThreshold = txs.length > 0 ? txs[0] : 0;
      const lateThreshold = txs.length > 0 ? txs[txs.length - 1] : 0;
      const totalRange = lateThreshold - earlyThreshold;

      txs.forEach((tx, index) => {
        // If within first 10% of transactions
        if (index < txs.length * 0.1) {
          const entryTime = (tx - earlyThreshold) / (totalRange || 1);
          earlyEntries.push(entryTime);
        }
      });
    });

    const averageEntryTime = earlyEntries.length > 0 ? earlyEntries.reduce((a, b) => a + b, 0) / earlyEntries.length : 0;
    const earlyEntriesCount = earlyEntries.length;

    return {
      score: Math.min(100, (averageEntryTime < 0.1 ? 100 : 100 - (averageEntryTime * 100))),
      earlyEntries: earlyEntriesCount,
      averageEntryTime,
    };
  }

  /**
   * ✅ Calculate Accumulation Behavior
   */
  private calculateAccumulationBehavior(transactions: any[]): any {
    const tokenBuys: Record<string, number[]> = {};
    const accumulationWallets: string[] = [];

    transactions.forEach(tx => {
      if (tx.tokenSymbol && tx.transactionType === 'BUY') {
        if (!tokenBuys[tx.tokenSymbol]) {
          tokenBuys[tx.tokenSymbol] = [];
        }
        tokenBuys[tx.tokenSymbol].push(tx.amount || 0);
      }
    });

    let totalAccumulation = 0;
    let accumulationCount = 0;

    Object.keys(tokenBuys).forEach(token => {
      const buys = tokenBuys[token];
      const avgBuy = buys.reduce((a, b) => a + b, 0) / buys.length;
      const maxBuy = Math.max(...buys);
      const minBuy = Math.min(...buys);

      // If average buy is significantly above min buy (accumulation pattern)
      if (avgBuy > minBuy * 1.5) {
        accumulationWallets.push(token);
        totalAccumulation += avgBuy - minBuy;
        accumulationCount++;
      }
    });

    const averageAccumulation = accumulationCount > 0 ? totalAccumulation / accumulationCount : 0;

    return {
      score: Math.min(100, accumulationCount * 10),
      accumulationWallets: accumulationWallets.length,
      averageAccumulation,
    };
  }

  /**
   * ✅ Calculate Chain Preference
   */
  private calculateChainPreference(transactions: any[]): Record<string, number> {
    const chainValues: Record<string, number> = {};

    transactions.forEach(tx => {
      if (tx.chain) {
        chainValues[tx.chain] = (chainValues[tx.chain] || 0) + Math.abs(tx.valueUsd || 0);
      }
    });

    const total = Object.values(chainValues).reduce((a, b) => a + b, 0);
    
    Object.keys(chainValues).forEach(chain => {
      chainValues[chain] = total > 0 ? (chainValues[chain] / total) * 100 : 0;
    });

    return chainValues;
  }

  /**
   * ✅ Calculate Protocol Preference
   */
  private calculateProtocolPreference(transactions: any[]): Record<string, number> {
    const protocolValues: Record<string, number> = {};

    transactions.forEach(tx => {
      // Extract protocol from transaction data
      const protocol = tx.protocol || tx.dexName || 'Unknown';
      protocolValues[protocol] = (protocolValues[protocol] || 0) + Math.abs(tx.valueUsd || 0);
    });

    const total = Object.values(protocolValues).reduce((a, b) => a + b, 0);
    
    Object.keys(protocolValues).forEach(protocol => {
      protocolValues[protocol] = total > 0 ? (protocolValues[protocol] / total) * 100 : 0;
    });

    return protocolValues;
  }

  /**
   * ✅ Calculate Token Preference
   */
  private calculateTokenPreference(transactions: any[]): string[] {
    const tokenValues: Record<string, number> = {};

    transactions.forEach(tx => {
      if (tx.tokenSymbol) {
        tokenValues[tx.tokenSymbol] = (tokenValues[tx.tokenSymbol] || 0) + Math.abs(tx.valueUsd || 0);
      }
    });

    // Sort by value and return top tokens
    return Object.keys(tokenValues)
      .sort((a, b) => tokenValues[b] - tokenValues[a])
      .slice(0, 10);
  }

  /**
   * ✅ Calculate Profitability Score
   */
  private calculateProfitabilityScore(pnl: any, roi: any, winRate: any): number {
    const pnlScore = Math.min(100, Math.max(0, (pnl.total / 1000) * 10));
    const roiScore = Math.min(100, Math.max(0, roi.total));
    const winRateScore = Math.min(100, winRate.overall);
    
    return (pnlScore * 0.4) + (roiScore * 0.3) + (winRateScore * 0.3);
  }

  /**
   * ✅ Calculate Smart Money Score
   */
  private calculateSmartMoneyScore(data: {
    winRate: number;
    drawdown: number;
    consistency: number;
    earlyEntryBehavior: number;
    accumulationBehavior: number;
  }): number {
    const winRateScore = Math.min(100, data.winRate);
    const drawdownScore = Math.max(0, 100 - data.drawdown);
    const consistencyScore = data.consistency;
    const earlyEntryScore = data.earlyEntryBehavior;
    const accumulationScore = data.accumulationBehavior;

    return (
      winRateScore * 0.25 +
      drawdownScore * 0.2 +
      consistencyScore * 0.2 +
      earlyEntryScore * 0.175 +
      accumulationScore * 0.175
    );
  }

  /**
   * ✅ Calculate Wallet Score
   */
  private calculateWalletScore(data: {
    pnl: number;
    roi: number;
    winRate: number;
    consistency: number;
    smartMoneyScore: number;
  }): number {
    const pnlScore = Math.min(100, Math.max(0, (data.pnl / 50000) * 100));
    const roiScore = Math.min(100, Math.max(0, data.roi));
    const winRateScore = Math.min(100, data.winRate);
    const consistencyScore = data.consistency;
    const smartScore = data.smartMoneyScore;

    return (
      pnlScore * 0.2 +
      roiScore * 0.2 +
      winRateScore * 0.2 +
      consistencyScore * 0.2 +
      smartScore * 0.2
    );
  }
}

export const walletAnalytics = WalletAnalyticsService.getInstance();