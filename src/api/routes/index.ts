// src/api/routes/index.ts

import { NextRequest, NextResponse } from 'next/server';
import { WalletController } from '../controllers/wallet.controller';
import { PriceController } from '../controllers/price.controller';
import { NFTController } from '../controllers/nft.controller';

const walletController = WalletController.getInstance();
const priceController = PriceController.getInstance();
const nftController = NFTController.getInstance();

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const path = url.pathname;

  // ✅ Health check
  if (path === '/api/v1/health') {
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  }

  // ✅ Wallet routes
  if (path.startsWith('/api/v1/wallet/')) {
    return walletController.getWallet(request);
  }

  // ✅ Price routes
  if (path === '/api/v1/prices') {
    return priceController.getPrices(request);
  }

  // ✅ NFT routes
  if (path === '/api/v1/nfts') {
    if (request.nextUrl.searchParams.get('action') === 'check') {
      return nftController.checkNFTs(request);
    }
    return nftController.getNFTs(request);
  }

  // ✅ 404
  return NextResponse.json({
    success: false,
    error: 'Endpoint not found',
    timestamp: new Date().toISOString(),
    statusCode: 404,
  }, { status: 404 });
}