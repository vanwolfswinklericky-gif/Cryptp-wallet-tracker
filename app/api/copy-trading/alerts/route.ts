// app/api/copy-trading/alerts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { copyTradingService } from '@/lib/services/copy-trading.service';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const CreateAlertSchema = z.object({
  walletId: z.string(),
  webhookUrl: z.string().url(),
  webhookSecret: z.string().optional(),
  monitorBuy: z.boolean().optional(),
  monitorSell: z.boolean().optional(),
  monitorSwap: z.boolean().optional(),
  minValueUsd: z.number().optional(),
  tokenWhitelist: z.array(z.string()).optional(),
  tokenBlacklist: z.array(z.string()).optional(),
  maxAlertsPerDay: z.number().optional(),
  alertCooldown: z.number().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'mock-user-id';
    const body = await request.json();

    const validated = CreateAlertSchema.parse(body);

    const alert = await copyTradingService.createAlert(userId, validated);

    return NextResponse.json({
      success: true,
      data: alert,
      timestamp: new Date().toISOString(),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      );
    }
    logger.error('Failed to create copy-trade alert:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create alert' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'mock-user-id';
    const alerts = await copyTradingService.getUserAlerts(userId);

    return NextResponse.json({
      success: true,
      data: alerts,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch alerts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}