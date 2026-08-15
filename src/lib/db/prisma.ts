// src/lib/db/prisma.ts
import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

declare global {
  var prisma: PrismaClient | undefined;
}

const isBuildTime = process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL;

function getPrismaClient() {
  if (isBuildTime || !process.env.DATABASE_URL) {
    return new PrismaClient({
      log: ['error'],
    }).$extends(withAccelerate());
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  }).$extends(withAccelerate());
}

export const prisma = global.prisma || getPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export default prisma;