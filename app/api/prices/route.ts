import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const addresses = searchParams.get('addresses');
  const symbols = searchParams.get('symbols');
  
  // ✅ Use Alchemy with addresses (preferred)
  if (addresses) {
    const apiKey = process.env.ALCHEMY_API_KEY;
    
    if (!apiKey) {
      console.error('❌ ALCHEMY_API_KEY not set');
      return NextResponse.json({ error: 'Alchemy API key not configured' }, { status: 500 });
    }

    try {
      const url = `https://api.g.alchemy.com/prices/v1/tokens/by-address?addresses=${addresses}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
        next: { revalidate: 60 },
      });

      if (!response.ok) {
        throw new Error(`Alchemy API error: ${response.status}`);
      }

      const data = await response.json();
      
      return NextResponse.json(data, {
        headers: {
          'Cache-Control': 's-maxage=60, stale-while-revalidate=30',
          'Access-Control-Allow-Origin': '*',
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

  // ❌ Fallback: CoinGecko (limited support, avoid if possible)
  if (symbols) {
    const SYMBOL_TO_ID: Record<string, string> = {
      'ETH': 'ethereum',
      'USDC': 'usd-coin',
      'USDT': 'tether',
      'WBTC': 'wrapped-bitcoin',
      'LINK': 'chainlink',
      'UNI': 'uniswap',
      'MATIC': 'polygon',
      'BNB': 'binancecoin',
      'ARB': 'arbitrum',
      'OP': 'optimism',
      'AVAX': 'avalanche-2',
      'DAI': 'dai',
      'AAVE': 'aave',
      'SOL': 'solana',
      'MKR': 'maker',
      'CRV': 'curve-dao-token',
      'CVX': 'convex-finance',
    };

    const symbolList = symbols.split(',');
    const validSymbols = symbolList.filter(s => SYMBOL_TO_ID[s.toUpperCase()]);

    if (validSymbols.length === 0) {
      return NextResponse.json({ error: 'No valid symbols' }, { status: 400 });
    }

    const ids = validSymbols.map(s => SYMBOL_TO_ID[s.toUpperCase()]).join(',');

    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        next: { revalidate: 60 },
      });

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();
      
      const result: Record<string, number> = {};
      validSymbols.forEach(symbol => {
        const id = SYMBOL_TO_ID[symbol.toUpperCase()];
        result[symbol] = data[id]?.usd || 0;
      });

      return NextResponse.json(result, {
        headers: {
          'Cache-Control': 's-maxage=60, stale-while-revalidate=30',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (error) {
      console.error('❌ CoinGecko API failed:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: 'No addresses or symbols provided' }, { status: 400 });
}