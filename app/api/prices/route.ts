import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const addresses = searchParams.get('addresses');
  
  if (!addresses) {
    return NextResponse.json({ error: 'No addresses provided' }, { status: 400 });
  }

  const apiKey = process.env.ALCHEMY_API_KEY;
  
  if (!apiKey) {
    console.error('❌ ALCHEMY_API_KEY not set in environment');
    return NextResponse.json({ error: 'Alchemy API key not configured' }, { status: 500 });
  }

  try {
    // ✅ Updated Alchemy Prices API v2 endpoint
    // Uses the correct format: /prices/v2/tokens/by-address
    const url = `https://api.g.alchemy.com/prices/v2/tokens/by-address?addresses=${addresses}`;
    
    console.log(`🔍 Fetching Alchemy prices for: ${addresses}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Alchemy API error (${response.status}):`, errorText);
      throw new Error(`Alchemy API error: ${response.status}`);
    }

    const data = await response.json();
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 's-maxage=60, stale-while-revalidate=30',
      },
    });
  } catch (error) {
    console.error('❌ Alchemy API failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}