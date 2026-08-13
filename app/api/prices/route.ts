import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbols = searchParams.get('symbols');
  
  if (!symbols) {
    return NextResponse.json({ error: 'No symbols provided' }, { status: 400 });
  }

  // ✅ Map symbols to CoinGecko IDs
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
    // ✅ CoinGecko API (free, no API key needed)
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
    });

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Map back to symbols
    const result: Record<string, number> = {};
    validSymbols.forEach(symbol => {
      const id = SYMBOL_TO_ID[symbol.toUpperCase()];
      result[symbol] = data[id]?.usd || 0;
    });

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 's-maxage=60, stale-while-revalidate=30',
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