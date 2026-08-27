// app/api/export/csv/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { exportService } from '@/lib/services/export.service';
import { auth } from '@/lib/auth';
import { rateLimit } from '@/lib/middleware/rate-limit';

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.ip || 'unknown';
    const isRateLimited = await rateLimit.check(ip, 'export', 5, 60); // 5 requests per minute
    if (isRateLimited) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait.' },
        { status: 429 }
      );
    }

    const user = await auth.getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') as 'holdings' | 'transactions' | 'complete' || 'holdings';
    const walletId = searchParams.get('walletId') || undefined;

    const data = await exportService.exportToCSV(user.id, { type, walletId });

    // Generate CSV string
    const csvContent = [
      data.headers.join(','),
      ...data.rows.map(row => 
        data.headers.map(header => {
          const value = row[header] ?? '';
          return typeof value === 'string' && value.includes(',') 
            ? `"${value}"` 
            : value;
        }).join(',')
      ),
    ].join('\n');

    // Return as downloadable file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=holdings_${new Date().toISOString().split('T')[0]}.csv`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}