// app/api/copy-trading/alerts/[id]/logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { copyTradingService } from '@/lib/services/copy-trading.service';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get('x-user-id') || 'mock-user-id';
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');

    // Verify alert ownership
    const alerts = await copyTradingService.getUserAlerts(userId);
    const alert = alerts.find(a => a.id === id);

    if (!alert) {
      return NextResponse.json(
        { success: false, error: 'Alert not found' },
        { status: 404 }
      );
    }

    const logs = await copyTradingService.getAlertLogs(id, limit);

    return NextResponse.json({
      success: true,
      data: logs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch alert logs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch logs' },
      { status: 500 }
    );
  }
}