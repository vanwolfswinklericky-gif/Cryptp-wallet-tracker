import { NextRequest, NextResponse } from 'next/server';
import { getEthBalance, getTransactionHistory } from '@/lib/etherscan';

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const { address } = params;
    const searchParams = request.nextUrl.searchParams;
    const includeTxs = searchParams.get('includeTxs') === 'true';

    // Validate address
    if (!address || !/^0x[a-fA-F0-9]{40}$/i.test(address)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    // Get balance
    const balance = await getEthBalance(address);

    // Build response
    const response: any = {
      address,
      balance: balance,
      balanceFormatted: balance.toFixed(6),
      symbol: 'ETH',
      transactions: [],
      transactionsCount: 0
    };

    // Optionally include transactions
    if (includeTxs) {
      try {
        const transactions = await getTransactionHistory(address, 0, 99999999, 'desc');
        response.transactions = transactions.slice(0, 10);
        response.transactionsCount = transactions.length;
      } catch (txError) {
        console.error('Error fetching transactions:', txError);
      }
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching wallet data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallet data' },
      { status: 500 }
    );
  }
}