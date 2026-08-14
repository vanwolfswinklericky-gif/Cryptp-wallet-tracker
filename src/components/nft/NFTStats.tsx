'use client';

import { useState, useEffect } from 'react';
import { Image, Layers, TrendingUp, Loader2 } from 'lucide-react';
import { getNFTsForWallet, NFT } from '@/lib/nft';

interface NFTStatsProps {
  address: string;
  chain?: string;
}

export default function NFTStats({ address, chain = 'ethereum' }: NFTStatsProps) {
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNFTs = async () => {
      if (!address) return;
      setLoading(true);
      try {
        const data = await getNFTsForWallet(address, chain);
        setNfts(data);
      } catch (error) {
        console.error('Failed to fetch NFTs:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchNFTs();
  }, [address, chain]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-4">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
        <span className="text-sm text-gray-500 dark:text-gray-400">Loading NFTs...</span>
      </div>
    );
  }

  const uniqueCollections = new Set(nfts.map(n => n.collectionName)).size;

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <Image className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Total NFTs</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{nfts.length}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
          <Layers className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Collections</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{uniqueCollections}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg">
          <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Floor Value</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            ${nfts.reduce((sum, n) => sum + (n.floorPrice || 0), 0).toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
}