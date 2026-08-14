'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Loader2, ExternalLink, Wallet } from 'lucide-react';
import { NFT, getNFTsForWallet } from '@/lib/nft';

interface NFTGalleryProps {
  address: string;
  chain?: string;
}

export default function NFTGallery({ address, chain = 'ethereum' }: NFTGalleryProps) {
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null);

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
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading NFTs...</p>
      </div>
    );
  }

  if (!nfts || nfts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Wallet className="h-12 w-12 text-gray-400 dark:text-gray-500" />
        <p className="mt-4 text-lg font-medium text-gray-700 dark:text-gray-300">
          No NFTs found
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          This wallet doesn't have any NFTs on {chain}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ✅ NFT Count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {nfts.length} NFTs
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            on {chain}
          </span>
        </div>
      </div>

      {/* ✅ NFT Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {nfts.map((nft, index) => (
          <div
            key={`${nft.contractAddress}-${nft.tokenId}`}
            className="group bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer border border-gray-100 dark:border-gray-700"
            onClick={() => setSelectedNFT(nft)}
          >
            {/* ✅ NFT Image */}
            <div className="relative aspect-square bg-gray-100 dark:bg-gray-700 overflow-hidden">
              {nft.imageUrl ? (
                <img
                  src={nft.imageUrl}
                  alt={nft.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder-nft.png';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <span className="text-4xl">🖼️</span>
                </div>
              )}
            </div>

            {/* ✅ NFT Info */}
            <div className="p-3">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {nft.title}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {nft.collectionName}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ✅ NFT Detail Modal */}
      {selectedNFT && (
        <NFTOverlay nft={selectedNFT} onClose={() => setSelectedNFT(null)} />
      )}
    </div>
  );
}

// ============================================================
// NFT OVERLAY
// ============================================================

function NFTOverlay({ nft, onClose }: { nft: NFT; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full mx-4 overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ✅ Image */}
        <div className="relative aspect-square bg-gray-100 dark:bg-gray-700">
          {nft.imageUrl ? (
            <img
              src={nft.imageUrl}
              alt={nft.title}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <span className="text-6xl">🖼️</span>
            </div>
          )}
        </div>

        {/* ✅ Info */}
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {nft.title}
          </h2>
          
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Collection:
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {nft.collectionName}
            </span>
          </div>

          {nft.description && (
            <div className="mt-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {nft.description}
              </p>
            </div>
          )}

          {/* ✅ Attributes */}
          {nft.attributes && nft.attributes.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Attributes
              </h4>
              <div className="flex flex-wrap gap-2">
                {nft.attributes.slice(0, 6).map((attr, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-md text-xs text-gray-700 dark:text-gray-300"
                  >
                    {attr.trait_type}: {attr.value}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ✅ Actions */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
            <a
              href={`https://etherscan.io/nft/${nft.contractAddress}/${nft.tokenId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              View on Etherscan
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}