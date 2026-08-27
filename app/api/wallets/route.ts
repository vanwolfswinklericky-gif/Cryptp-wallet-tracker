// app/api/wallets/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { walletService } from '@/lib/domain/wallet/wallet.service';
import { auth } from '@/lib/auth';
import { APIResponse } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const user = await auth.getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || undefined;
    const chain = searchParams.get('chain') || undefined;
    const includeArchived = searchParams.get('includeArchived') === 'true';

    const result = await walletService.getUserWallets(user.id, {
      page,
      limit,
      search,
      chain,
      includeArchived,
    });

    const response: APIResponse = {
      success: true,
      data: result.data,
      metadata: result.pagination,
      timestamp: new Date().toISOString(),
      statusCode: 200,
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await auth.getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const wallet = await walletService.createWallet(user.id, body, {
      ipAddress: request.ip || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    const response: APIResponse = {
      success: true,
      data: wallet,
      timestamp: new Date().toISOString(),
      statusCode: 201,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}