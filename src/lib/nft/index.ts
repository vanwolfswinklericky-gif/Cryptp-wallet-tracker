// src/lib/nft/index.ts

export interface NFT {
  contractAddress: string;
  tokenId: string;
  title: string;
  description: string;
  imageUrl: string;
  collectionName: string;
  collectionSymbol: string;
  floorPrice?: number;
  lastSalePrice?: number;
  owner: string;
  chain: string;
  attributes?: { trait_type: string; value: string }[];
}

export interface NFTCollection {
  address: string;
  name: string;
  symbol: string;
  totalSupply: number;
  floorPrice?: number;
  imageUrl?: string;
}

// ============================================================
// NFT FETCHING
// ============================================================

/**
 * Fetch NFTs for a wallet using Alchemy API
 */
export async function getNFTsForWallet(
  address: string,
  chain: string = 'ethereum'
): Promise<NFT[]> {
  const apiKey = process.env.ALCHEMY_API_KEY;
  
  if (!apiKey) {
    console.warn('⚠️ ALCHEMY_API_KEY not set');
    return [];
  }

  try {
    // ✅ Alchemy's getNFTs endpoint
    const response = await fetch(
      `/api/nft?address=${address}&chain=${chain}`,
      {
        headers: { 'Accept': 'application/json' },
        cache: 'force-cache',
        next: { revalidate: 60 },
      }
    );

    if (!response.ok) {
      throw new Error(`NFT API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.nfts || data.nfts.length === 0) {
      return [];
    }

    return data.nfts.map((item: any) => ({
      contractAddress: item.contract.address,
      tokenId: item.id.tokenId,
      title: item.title || `${item.contract.name} #${item.id.tokenId.slice(0, 6)}`,
      description: item.description || '',
      imageUrl: item.media?.[0]?.raw || item.metadata?.image || '',
      collectionName: item.contract.name || 'Unknown Collection',
      collectionSymbol: item.contract.symbol || 'NFT',
      floorPrice: item.floorPrice,
      lastSalePrice: item.lastSalePrice,
      owner: address,
      chain: chain,
      attributes: item.metadata?.attributes || [],
    }));
  } catch (error) {
    console.error('❌ Failed to fetch NFTs:', error);
    return [];
  }
}

/**
 * Get NFT collection floor price
 */
export async function getCollectionFloorPrice(
  contractAddress: string,
  chain: string = 'ethereum'
): Promise<number> {
  try {
    const response = await fetch(
      `/api/nft/floor?contract=${contractAddress}&chain=${chain}`,
      {
        headers: { 'Accept': 'application/json' },
        cache: 'force-cache',
        next: { revalidate: 120 },
      }
    );

    if (!response.ok) return 0;
    
    const data = await response.json();
    return data.floorPrice || 0;
  } catch (error) {
    console.error('❌ Failed to fetch floor price:', error);
    return 0;
  }
}

/**
 * Check if a wallet has NFTs
 */
export async function hasNFTs(
  address: string,
  chain: string = 'ethereum'
): Promise<boolean> {
  try {
    const response = await fetch(
      `/api/nft/has?address=${address}&chain=${chain}`,
      {
        headers: { 'Accept': 'application/json' },
        cache: 'force-cache',
        next: { revalidate: 60 },
      }
    );

    if (!response.ok) return false;
    
    const data = await response.json();
    return data.hasNFTs || false;
  } catch (error) {
    console.error('❌ Failed to check NFTs:', error);
    return false;
  }
}