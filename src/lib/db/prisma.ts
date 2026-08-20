// src/lib/db/prisma.ts
import { PrismaClient } from '@prisma/client'

// Global declaration for Prisma Client
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

// Check if we're in a build environment without a database
const isBuildTime = process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL

// Create Prisma Client function
function createPrismaClient(): PrismaClient {
  // During build time, create a minimal client
  if (isBuildTime) {
    return new PrismaClient({
      log: ['error'],
    })
  }

  // Normal client for development/production
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

// Export singleton instance
export const prisma = global.prisma || createPrismaClient()

// Save to global in development
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
}

export default prisma