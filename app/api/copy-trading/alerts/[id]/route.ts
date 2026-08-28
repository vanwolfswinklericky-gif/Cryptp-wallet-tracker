// app/api/copy-trading/alerts/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { copyTradingService } from '@/lib/services/copy-trading.service';
import { logger } from '@/lib/logger';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get('x-user-id') || 'mock-user-id';
    const { id } = await params;
    const body = await request.json();

    const alert = await copyTradingService.updateAlert(id, userId, body);

    return NextResponse.json({
      success: true,
      data: alert,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to update alert:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update alert' },
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

    await copyTradingService.deleteAlert(id, userId);

    return NextResponse.json({
      success: true,
      message: 'Alert deleted successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to delete alert:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to delete alert' },
      { status: 500 }
    );
  }
}