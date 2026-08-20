\// src/lib/db/prisma.ts
import { PrismaClient } from '@prisma/client';

declare global {
  var prisma: PrismaClient | undefined;
}

// During build time, we don't need a real database connection
// This allows the build to complete without DATABASE_URL
const isBuildTime = process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL;

function createPrismaClient() {
  // During build, create a minimal client
  if (isBuildTime) {
    return new PrismaClient({
      log: ['error'],
    });
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

export const prisma = global.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export default prisma;