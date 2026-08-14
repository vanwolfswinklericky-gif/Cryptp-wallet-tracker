// src/api/controllers/wallet.controller.ts

import { NextRequest, NextResponse } from 'next/server';
import { WalletService } from '../services/wallet.service';
import { 
  validateWalletAddress, 
  validateChain, 
  validateLimit, 
  validateOffset 
} from '../validators/wallet.validator';
import { APIResponse } from '../types';

export class WalletController {
  private static instance: WalletController;
  private walletService = WalletService.getInstance();

  private constructor() {}

  static getInstance(): WalletController {
    if (!WalletController.instance) {
      WalletController.instance = new WalletController();
    }
    return WalletController.instance;
  }

  async getWallet(request: NextRequest): Promise<NextResponse> {
    try {
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/');
      const address = pathParts[pathParts.length - 1];
      
      const searchParams = request.nextUrl.searchParams;
      const chain = searchParams.get('chain') || 'ethereum';
      const includeTxs = searchParams.get('includeTxs') !== 'false';
      const includeTokens = searchParams.get('includeTokens') !== 'false';
      const includeNFTs = searchParams.get('includeNFTs') !== 'false';
      const limit = searchParams.get('limit');
      const offset = searchParams.get('offset');

      // ✅ Validate address
      const addressValidation = validateWalletAddress(address);
      if (!addressValidation.valid) {
        return this.errorResponse(addressValidation.error || 'Invalid address', 400);
      }

      // ✅ Validate chain
      const chainValidation = validateChain(chain);
      if (!chainValidation.valid) {
        return this.errorResponse(chainValidation.error || 'Invalid chain', 400);
      }

      // ✅ Validate limit
      const limitValidation = validateLimit(limit);
      if (!limitValidation.valid) {
        return this.errorResponse(limitValidation.error || 'Invalid limit', 400);
      }

      // ✅ Validate offset
      const offsetValidation = validateOffset(offset);
      if (!offsetValidation.valid) {
        return this.errorResponse(offsetValidation.error || 'Invalid offset', 400);
      }

      // ✅ Fetch wallet data
      const walletData = await this.walletService.getWalletData(
        address,
        chain,
        includeTxs,
        includeTokens,
        includeNFTs
      );

      // ✅ Apply pagination
      const start = offsetValidation.value;
      const end = start + limitValidation.value;
      
      const paginatedData = {
        ...walletData,
        transactions: walletData.transactions.slice(start, end),
        tokens: walletData.tokens.slice(start, end),
        nfts: walletData.nfts?.slice(start, end),
      };

      return this.successResponse(paginatedData, {
        page: Math.floor(start / limitValidation.value) + 1,
        limit: limitValidation.value,
        total: walletData.transactions.length,
        hasMore: end < walletData.transactions.length,
      });
    } catch (error) {
      console.error('Wallet API error:', error);
      return this.errorResponse(
        error instanceof Error ? error.message : 'Internal server error',
        500
      );
    }
  }

  private successResponse(data: any, pagination?: any): NextResponse {
    const response: APIResponse = {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      statusCode: 200,
      pagination,
    };
    return NextResponse.json(response, { status: 200 });
  }

  private errorResponse(error: string, statusCode: number = 400): NextResponse {
    const response: APIResponse = {
      success: false,
      error,
      timestamp: new Date().toISOString(),
      statusCode,
    };
    return NextResponse.json(response, { status: statusCode });
  }
}