// src/api/controllers/price.controller.ts

import { NextRequest, NextResponse } from 'next/server';
import { PriceService } from '../services/price.service';
import { APIResponse } from '../types';

export class PriceController {
  private static instance: PriceController;
  private priceService = PriceService.getInstance();

  private constructor() {}

  static getInstance(): PriceController {
    if (!PriceController.instance) {
      PriceController.instance = new PriceController();
    }
    return PriceController.instance;
  }

  async getPrices(request: NextRequest): Promise<NextResponse> {
    try {
      const searchParams = request.nextUrl.searchParams;
      const symbolsParam = searchParams.get('symbols');
      const addressesParam = searchParams.get('addresses');

      let symbols: string[] = [];

      if (symbolsParam) {
        symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());
      }

      if (addressesParam) {
        // If addresses are provided, we would need to map them to symbols
        // For now, we'll try to get symbols from the addresses
        // This is a simplified version
        const addresses = addressesParam.split(',').map(s => s.trim());
        // You would need a mapping from address to symbol here
        // For now, we'll return empty if only addresses are provided
        if (symbols.length === 0) {
          return this.errorResponse('Symbols are required for price lookup', 400);
        }
      }

      if (symbols.length === 0) {
        return this.errorResponse('At least one symbol is required', 400);
      }

      // ✅ Limit symbols to prevent abuse
      if (symbols.length > 100) {
        return this.errorResponse('Maximum 100 symbols allowed', 400);
      }

      const prices = await this.priceService.getPrices(symbols);

      return this.successResponse(prices);
    } catch (error) {
      console.error('Price API error:', error);
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