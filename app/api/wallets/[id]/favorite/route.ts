// app/api/wallets/[id]/favorite/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { walletService } from '@/lib/domain/wallet/wallet.service';
import { auth } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await auth.getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const wallet = await walletService.toggleFavorite(params.id, user.id);

    return NextResponse.json({ success: true, data: wallet });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}