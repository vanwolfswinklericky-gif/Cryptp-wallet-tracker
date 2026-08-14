// src/components/defi/DeFiPositions.tsx
'use client';

import { useState, useEffect } from 'react';
import { Loader2, TrendingUp, TrendingDown, Layers, DollarSign, Clock } from 'lucide-react';

interface DeFiPosition {
  protocol: string;
  type: 'lending' | 'staking' | 'liquidity' | 'yield' | 'vault';
  asset: string;
  amount: number;
  value: number;
  apy?: number;
  rewards?: { asset: string; amount: number; value: number }[];
  lockedUntil?: string;
  contractAddress: string;
  chain: string;
}

interface DeFiSummary {
  totalValue: number;
  protocols: string[];
  positions: number;
  apy: number;
  rewards: number;
}

interface Props {
  address: string;
  chain?: string;
}

export default function DeFiPositions({ address, chain = 'ethereum' }: Props) {
  const [positions, setPositions] = useState<DeFiPosition[]>([]);
  const [summary, setSummary] = useState<DeFiSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDeFiPositions = async () => {
      if (!address) return;
      
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/v1/defi/positions?address=${address}&chain=${chain}`
        );

        if (!response.ok) throw new Error('Failed to fetch DeFi positions');

        const data = await response.json();
        setPositions(data.data?.positions || []);
        setSummary(data.data?.summary || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchDeFiPositions();
  }, [address, chain]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
        <span className="ml-2 text-gray-500 dark:text-gray-400">Loading DeFi positions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500 dark:text-red-400">
        {error}
      </div>
    );
  }

  if (!positions || positions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <Layers className="h-12 w-12 mx-auto mb-3 text-gray-400 dark:text-gray-500" />
        <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
          No DeFi positions found
        </p>
        <p className="text-sm">
          This wallet doesn't have any DeFi positions on {chain}
        </p>
      </div>
    );
  }

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      lending: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      staking: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      liquidity: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      yield: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      vault: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    return colors[type] || 'bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-400';
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Value Locked</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              ${summary.totalValue.toFixed(2)}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">Protocols</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {summary.protocols.length}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">Average APY</p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">
              {summary.apy.toFixed(2)}%
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Rewards</p>
            <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
              ${summary.rewards.toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Positions List */}
      <div className="space-y-3">
        {positions.map((position, index) => (
          <div
            key={index}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm">
                  {position.protocol.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {position.protocol}
                  </p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`px-2 py-0.5 rounded-full ${getTypeColor(position.type)}`}>
                      {position.type}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {position.amount.toFixed(4)} {position.asset}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900 dark:text-white">
                  ${position.value.toFixed(2)}
                </p>
                {position.apy && (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    {position.apy.toFixed(2)}% APY
                  </p>
                )}
              </div>
            </div>
            
            {/* Rewards */}
            {position.rewards && position.rewards.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">Rewards:</p>
                <div className="flex gap-3 mt-1">
                  {position.rewards.map((reward, idx) => (
                    <span key={idx} className="text-xs bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full text-green-700 dark:text-green-400">
                      {reward.amount.toFixed(4)} {reward.asset} (${reward.value.toFixed(2)})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}