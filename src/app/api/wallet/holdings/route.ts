import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address');
  
  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 });
  }
  
  try {
    // Use Moralis API to get token balances with prices
    // This endpoint fetches ERC20 balances with USD values [citation:6]
    const response = await fetch(
      `https://deep-index.moralis.io/api/v2.2/${address}/erc20`,
      {
        headers: {
          'X-API-Key': process.env.MORALIS_API_KEY || '',
        },
      }
    );
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch holdings' }, { status: 500 });
  }
}