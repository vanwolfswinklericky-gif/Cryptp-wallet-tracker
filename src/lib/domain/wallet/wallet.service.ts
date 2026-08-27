// src/lib/domain/wallet/wallet.service.ts
import { prisma } from '@/lib/db/prisma';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { AuditService } from '@/lib/services/audit.service';
import { CacheService } from '@/lib/services/cache.service';
import { ValidationError, NotFoundError } from '@/lib/errors';
import { z } from 'zod';

// ✅ Zod validation schemas
const CreateWalletSchema = z.object({
  address: z.string().min(20, 'Invalid wallet address'),
  chain: z.enum(['ETHEREUM', 'POLYGON', 'BSC', 'ARBITRUM', 'OPTIMISM', 'AVALANCHE', 'BASE', 'SOLANA']),
  label: z.string().min(1).max(50).optional(),
  notes: z.string().max(500).optional(),
  isFavorite: z.boolean().optional(),
});

const UpdateWalletSchema = z.object({
  label: z.string().min(1).max(50).optional(),
  notes: z.string().max(500).optional(),
  isFavorite: z.boolean().optional(),
});

export class WalletService {
  private static instance: WalletService;
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly CACHE_PREFIX = 'wallet';

  private constructor() {}

  static getInstance(): WalletService {
    if (!WalletService.instance) {
      WalletService.instance = new WalletService();
    }
    return WalletService.instance;
  }

  /**
   * ✅ Create a new wallet with validation and audit logging
   */
  async createWallet(
    userId: string,
    input: z.infer<typeof CreateWalletSchema>,
    metadata?: { ipAddress?: string; userAgent?: string }
  ) {
    // Validate input
    const validated = CreateWalletSchema.parse(input);

    // Check for duplicate
    const existing = await prisma.wallet.findFirst({
      where: {
        address: validated.address,
        chain: validated.chain,
        userId: userId,
        isDeleted: false,
      },
    });

    if (existing) {
      throw new ValidationError('Wallet already exists for this user');
    }

    // Create wallet
    const wallet = await prisma.wallet.create({
      data: {
        address: validated.address,
        chain: validated.chain,
        label: validated.label,
        notes: validated.notes,
        isFavorite: validated.isFavorite || false,
        userId: userId,
      },
    });

    // Clear cache
    await this.invalidateCache(userId);

    // Audit log
    await AuditService.log({
      userId,
      action: 'CREATE',
      entityType: 'Wallet',
      entityId: wallet.id,
      metadata: { ...metadata, walletAddress: wallet.address },
    });

    logger.info('Wallet created', { userId, walletId: wallet.id });

    return wallet;
  }

  /**
   * ✅ Get user wallets with pagination and filtering
   */
  async getUserWallets(
    userId: string,
    options?: {
      page?: number;
      limit?: number;
      includeArchived?: boolean;
      search?: string;
      chain?: string;
    }
  ) {
    const page = options?.page || 1;
    const limit = Math.min(options?.limit || 20, 100);
    const skip = (page - 1) * limit;

    // Try cache first
    const cacheKey = CacheService.generateKey('user_wallets', { userId, ...options });
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const where: any = {
      userId,
      isDeleted: false,
    };

    if (!options?.includeArchived) {
      where.isArchived = false;
    }

    if (options?.search) {
      where.OR = [
        { address: { contains: options.search, mode: 'insensitive' } },
        { label: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    if (options?.chain) {
      where.chain = options.chain;
    }

    const [wallets, total] = await Promise.all([
      prisma.wallet.findMany({
        where,
        orderBy: [
          { isFavorite: 'desc' },
          { updatedAt: 'desc' },
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

    const result = {
      data: wallets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Cache result
    await CacheService.set(cacheKey, result, this.CACHE_TTL);

    return result;
  }

  /**
   * ✅ Get wallet by ID with permission check
   */
  async getWalletById(walletId: string, userId: string) {
    // Try cache
    const cacheKey = CacheService.generateKey('wallet_detail', { walletId, userId });
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const wallet = await prisma.wallet.findFirst({
      where: {
        id: walletId,
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
      throw new NotFoundError('Wallet not found');
    }

    // Cache result
    await CacheService.set(cacheKey, wallet, this.CACHE_TTL);

    return wallet;
  }

  /**
   * ✅ Update wallet with validation
   */
  async updateWallet(
    walletId: string,
    userId: string,
    input: z.infer<typeof UpdateWalletSchema>
  ) {
    const validated = UpdateWalletSchema.parse(input);

    // Check ownership
    const existing = await prisma.wallet.findFirst({
      where: { id: walletId, userId, isDeleted: false },
    });

    if (!existing) {
      throw new NotFoundError('Wallet not found');
    }

    const wallet = await prisma.wallet.update({
      where: { id: walletId },
      data: validated,
    });

    // Invalidate caches
    await this.invalidateCache(userId);
    await CacheService.delete(CacheService.generateKey('wallet_detail', { walletId, userId }));

    // Audit log
    await AuditService.log({
      userId,
      action: 'UPDATE',
      entityType: 'Wallet',
      entityId: wallet.id,
      changes: validated,
    });

    logger.info('Wallet updated', { userId, walletId });

    return wallet;
  }

  /**
   * ✅ Soft delete wallet
   */
  async deleteWallet(walletId: string, userId: string) {
    const existing = await prisma.wallet.findFirst({
      where: { id: walletId, userId, isDeleted: false },
    });

    if (!existing) {
      throw new NotFoundError('Wallet not found');
    }

    const wallet = await prisma.wallet.update({
      where: { id: walletId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    await this.invalidateCache(userId);
    await CacheService.delete(CacheService.generateKey('wallet_detail', { walletId, userId }));

    await AuditService.log({
      userId,
      action: 'DELETE',
      entityType: 'Wallet',
      entityId: wallet.id,
    });

    logger.info('Wallet deleted (soft)', { userId, walletId });

    return wallet;
  }

  /**
   * ✅ Toggle favorite status
   */
  async toggleFavorite(walletId: string, userId: string) {
    const existing = await prisma.wallet.findFirst({
      where: { id: walletId, userId, isDeleted: false },
    });

    if (!existing) {
      throw new NotFoundError('Wallet not found');
    }

    const wallet = await prisma.wallet.update({
      where: { id: walletId },
      data: { isFavorite: !existing.isFavorite },
    });

    await this.invalidateCache(userId);

    return wallet;
  }

  /**
   * ✅ Invalidate user's wallet cache
   */
  private async invalidateCache(userId: string) {
    const pattern = `*${this.CACHE_PREFIX}*${userId}*`;
    await CacheService.deletePattern(pattern);
  }
}

// Singleton export
export const walletService = WalletService.getInstance();