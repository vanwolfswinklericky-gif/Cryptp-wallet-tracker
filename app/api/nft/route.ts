// app/api/nft/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');
  const chain = searchParams.get('chain') || 'ethereum';
  
  if (!address) {
    return NextResponse.json({ error: 'No address provided' }, { status: 400 });
  }

  const apiKey = process.env.ALCHEMY_API_KEY;
  
  if (!apiKey) {
    console.error('❌ ALCHEMY_API_KEY not set');
    return NextResponse.json({ error: 'Alchemy API key not configured' }, { status: 500 });
  }

  try {
    // ✅ Alchemy NFT API
    const networkMap: Record<string, string> = {
      ethereum: 'eth-mainnet',
      polygon: 'polygon-mainnet',
      arbitrum: 'arb-mainnet',
      optimism: 'opt-mainnet',
      base: 'base-mainnet',
    };

    const network = networkMap[chain] || 'eth-mainnet';
    
    // ✅ Get NFTs with metadata
    const url = `https://${network}.g.alchemy.com/nft/v2/${apiKey}/getNFTs?owner=${address}&withMetadata=true&pageSize=50`;
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      throw new Error(`Alchemy NFT API error: ${response.status}`);
    }

    const data = await response.json();
    
    // ✅ Transform to our format
    const nfts = (data.ownedNfts || []).map((item: any) => ({
      contract: {
        address: item.contract.address,
        name: item.contract.name || 'Unknown',
        symbol: item.contract.symbol || 'NFT',
      },
      id: {
        tokenId: item.id.tokenId,
      },
      title: item.title || `${item.contract.name || 'NFT'} #${parseInt(item.id.tokenId, 16)}`,
      description: item.description || '',
      media: item.media || [{ raw: item.metadata?.image || item.tokenUri?.raw || '' }],
      metadata: item.metadata || {},
      floorPrice: 0,
      lastSalePrice: 0,
    }));

    return NextResponse.json({
      nfts,
      totalCount: data.totalCount || 0,
      pageKey: data.pageKey,
    }, {
      headers: {
        'Cache-Control': 's-maxage=60, stale-while-revalidate=30',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('❌ NFT API failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}