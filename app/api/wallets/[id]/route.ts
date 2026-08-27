// app/api/wallets/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const UpdateWalletSchema = z.object({
  label: z.string().min(1).max(50).optional(),
  notes: z.string().max(500).optional(),
  isFavorite: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get('x-user-id') || 'mock-user-id';
    const { id } = await params;

    const wallet = await prisma.wallet.findFirst({
      where: {
        id,
        userId,
        isDeleted: false,
      },
      include: {
        metrics: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
        transactions: {
          orderBy: { timestamp: 'desc' },
          take: 50,
        },
      },
    });

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'Wallet not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: wallet,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to fetch wallet:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch wallet' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get('x-user-id') || 'mock-user-id';
    const { id } = await params;
    const body = await request.json();

    const validated = UpdateWalletSchema.parse(body);

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
        label: validated.label,
        notes: validated.notes,
        isFavorite: validated.isFavorite,
        isArchived: validated.isArchived,
        lastUpdated: new Date(), // ✅ Use lastUpdated
      },
    });

    return NextResponse.json({
      success: true,
      data: wallet,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error('Failed to update wallet:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update wallet' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: wallet,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to delete wallet:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete wallet' },
      { status: 500 }
    );
  }
}