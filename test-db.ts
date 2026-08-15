// test-db.ts
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

async function main() {
  try {
    console.log('🔍 Testing database connection...');
    
    // Create connection pool
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    // Create adapter
    const adapter = new PrismaPg(pool);

    // Create Prisma client with adapter
    const prisma = new PrismaClient({ adapter });

    // Test connection
    const result = await prisma.$queryRaw`SELECT NOW() as current_time`;
    console.log('✅ Database connected!');
    console.log('📊 Current time:', result);

    // Count wallets
    const walletCount = await prisma.wallet.count();
    console.log(`📊 Found ${walletCount} wallets in database.`);

    // Test insert
    const wallet = await prisma.wallet.create({
      data: {
        address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        chain: 'ethereum',
        label: 'Vitalik Buterin',
        isVerified: true,
      },
    });
    console.log(`✅ Created wallet: ${wallet.address} (${wallet.label})`);

    // Add metrics
    const metrics = await prisma.walletMetric.create({
      data: {
        walletId: wallet.id,
        chain: 'ethereum',
        totalPnl: 25000.50,
        totalRoi: 45.50,
        winRate: 68.50,
        tradeCount: 156,
        walletScore: 92,
        portfolioValue: 1500000.00,
      },
    });
    console.log(`✅ Added metrics: PnL $${metrics.totalPnl}, Score ${metrics.walletScore}`);

    // Query with join
    const resultData = await prisma.wallet.findFirst({
      where: { address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
      include: { metrics: true },
    });
    console.log(`📊 Wallet: ${resultData?.label}`);
    console.log(`   PnL: $${resultData?.metrics[0]?.totalPnl}`);
    console.log(`   Win Rate: ${resultData?.metrics[0]?.winRate}%`);
    console.log(`   Score: ${resultData?.metrics[0]?.walletScore}`);

    await pool.end();
  } catch (error) {
    console.error('❌ Database error:', error);
  }
}

main();