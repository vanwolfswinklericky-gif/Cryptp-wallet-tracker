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
    return NextResponse.json({ hasNFTs: false }, { status: 200 });
  }

  try {
    const networkMap: Record<string, string> = {
      ethereum: 'eth-mainnet',
      polygon: 'polygon-mainnet',
      arbitrum: 'arb-mainnet',
      optimism: 'opt-mainnet',
      base: 'base-mainnet',
    };

    const network = networkMap[chain] || 'eth-mainnet';
    
    const url = `https://${network}.g.alchemy.com/nft/v2/${apiKey}/getNFTs?owner=${address}&withMetadata=false&pageSize=1`;
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      return NextResponse.json({ hasNFTs: false }, { status: 200 });
    }

    const data = await response.json();
    
    return NextResponse.json({
      hasNFTs: (data.totalCount || 0) > 0,
    }, {
      headers: {
        'Cache-Control': 's-maxage=60, stale-while-revalidate=30',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('❌ NFT check failed:', error);
    return NextResponse.json({ hasNFTs: false }, { status: 200 });
  }
}