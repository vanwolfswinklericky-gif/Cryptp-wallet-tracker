// src/api/controllers/nft.controller.ts

import { NextRequest, NextResponse } from 'next/server';
import { WalletService } from '../services/wallet.service';
import { validateWalletAddress, validateChain } from '../validators/wallet.validator';
import { APIResponse } from '../types';

export class NFTController {
  private static instance: NFTController;
  private walletService = WalletService.getInstance();

  private constructor() {}

  static getInstance(): NFTController {
    if (!NFTController.instance) {
      NFTController.instance = new NFTController();
    }
    return NFTController.instance;
  }

  async getNFTs(request: NextRequest): Promise<NextResponse> {
    try {
      const searchParams = request.nextUrl.searchParams;
      const address = searchParams.get('address');
      const chain = searchParams.get('chain') || 'ethereum';

      // ✅ Validate address
      if (!address) {
        return this.errorResponse('Wallet address is required', 400);
      }

      const addressValidation = validateWalletAddress(address);
      if (!addressValidation.valid) {
        return this.errorResponse(addressValidation.error || 'Invalid address', 400);
      }

      // ✅ Validate chain
      const chainValidation = validateChain(chain);
      if (!chainValidation.valid) {
        return this.errorResponse(chainValidation.error || 'Invalid chain', 400);
      }

      // ✅ Fetch NFTs
      const walletData = await this.walletService.getWalletData(
        address,
        chain,
        false, // No transactions
        false, // No tokens
        true   // Only NFTs
      );

      return this.successResponse({
        address,
        chain,
        nfts: walletData.nfts || [],
        count: walletData.nfts?.length || 0,
      });
    } catch (error) {
      console.error('NFT API error:', error);
      return this.errorResponse(
        error instanceof Error ? error.message : 'Internal server error',
        500
      );
    }
  }

  async checkNFTs(request: NextRequest): Promise<NextResponse> {
    try {
      const searchParams = request.nextUrl.searchParams;
      const address = searchParams.get('address');
      const chain = searchParams.get('chain') || 'ethereum';

      if (!address) {
        return this.errorResponse('Wallet address is required', 400);
      }

      const addressValidation = validateWalletAddress(address);
      if (!addressValidation.valid) {
        return this.errorResponse(addressValidation.error || 'Invalid address', 400);
      }

      const walletData = await this.walletService.getWalletData(
        address,
        chain,
        false,
        false,
        true
      );

      return this.successResponse({
        address,
        chain,
        hasNFTs: (walletData.nfts?.length || 0) > 0,
        count: walletData.nfts?.length || 0,
      });
    } catch (error) {
      console.error('NFT check error:', error);
      return this.errorResponse(
        error instanceof Error ? error.message : 'Internal server error',
        500
      );
    }
  }

  private successResponse(data: any): NextResponse {
    const response: APIResponse = {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      statusCode: 200,
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