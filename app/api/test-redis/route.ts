import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

export async function GET() {
  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL || '',
      token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    });

    // Test connection
    await redis.set('test', 'Hello from Upstash!');
    const value = await redis.get('test');

    return NextResponse.json({
      success: true,
      message: 'Redis connected!',
      testValue: value,
      url: process.env.UPSTASH_REDIS_REST_URL?.replace(/\/\/.*@/, '//*****@'),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}