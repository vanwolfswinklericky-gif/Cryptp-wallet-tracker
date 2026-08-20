// src/lib/db/prisma.ts
import { PrismaClient } from '@prisma/client'
import { withPgAdapter } from '@prisma/adapter-pg'
import { Pool } from 'pg'

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

const isBuildTime = process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL

function createPrismaClient(): PrismaClient {
  // During build time, create a minimal client without adapter
  if (isBuildTime) {
    return new PrismaClient({
      log: ['error'],
    })
  }

  // Create a connection pool for PostgreSQL
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })
  
  const adapter = withPgAdapter(pool)

  // Normal client with driver adapter
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

export const prisma = global.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
}

export default prisma