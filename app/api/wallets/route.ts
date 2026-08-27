// app/api/wallets/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const CreateWalletSchema = z.object({
  address: z.string().min(20, 'Invalid wallet address'),
  chain: z.enum(['ETHEREUM', 'POLYGON', 'BSC', 'ARBITRUM', 'OPTIMISM', 'AVALANCHE', 'BASE', 'SOLANA']),
  label: z.string().min(1).max(50).optional(),
  notes: z.string().max(500).optional(),
  isFavorite: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'mock-user-id';

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const skip = (page - 1) * limit;
    const search = searchParams.get('search') || undefined;
    const chain = searchParams.get('chain') || undefined;
    const includeArchived = searchParams.get('includeArchived') === 'true';

    const where: any = {
      userId,
      isDeleted: false,
    };

    if (!includeArchived) {
      where.isArchived = false;
    }

    if (search) {
      where.OR = [
        { address: { contains: search, mode: 'insensitive' } },
        { label: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (chain) {
      where.chain = chain;
    }

    const [wallets, total] = await Promise.all([
      prisma.wallet.findMany({
        where,
        orderBy: [
          { isFavorite: 'desc' },
          { lastUpdated: 'desc' }, // ✅ Use lastUpdated instead of updatedAt
        ],
        skip,
        take: limit,
        include: {
          metrics: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
      }),
      prisma.wallet.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: wallets,
      metadata: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to fetch wallets:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch wallets' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'mock-user-id';
    const body = await request.json();

    const validated = CreateWalletSchema.parse(body);

    const existing = await prisma.wallet.findFirst({
      where: {
        address: validated.address,
        chain: validated.chain,
        userId,
        isDeleted: false,
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Wallet already exists' },
        { status: 400 }
      );
    }

    const wallet = await prisma.wallet.create({
      data: {
        address: validated.address,
        chain: validated.chain,
        label: validated.label,
        notes: validated.notes,
        isFavorite: validated.isFavorite || false,
        userId,
        firstSeen: new Date(),
        lastUpdated: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: wallet,
      timestamp: new Date().toISOString(),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error('Failed to create wallet:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create wallet' },
      { status: 500 }
    );
  }
}