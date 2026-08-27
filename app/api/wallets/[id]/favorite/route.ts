// app/api/wallets/[id]/favorite/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get('x-user-id') || 'mock-user-id';
    const { id } = await params;

    const existing = await prisma.wallet.findFirst({
      where: {
        id,
        userId,
        isDeleted: false,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Wallet not found' },
        { status: 404 }
      );
    }

    const wallet = await prisma.wallet.update({
      where: { id },
      data: {
        isFavorite: !existing.isFavorite,
        lastUpdated: new Date(), // ✅ Use lastUpdated
      },
    });

    return NextResponse.json({
      success: true,
      data: wallet,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to toggle favorite:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to toggle favorite' },
      { status: 500 }
    );
  }
}