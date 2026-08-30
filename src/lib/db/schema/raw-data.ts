// src/lib/db/schema/raw-data.ts
export const rawDataSchema = {
  raw_transactions: {
    id: 'String @id',
    chain: 'String',
    txHash: 'String @unique',
    blockNumber: 'BigInt',
    blockHash: 'String',
    timestamp: 'DateTime',
    fromAddress: 'String',
    toAddress: 'String',
    rawData: 'Json', // Complete original provider response
    provider: 'String', // alchemy, moralis, infura
    providerId: 'String',
    ingestedAt: 'DateTime @default(now())',
    status: 'String', // PENDING, PROCESSED, FAILED
    retryCount: 'Int @default(0)',
    error: 'String?',
    processedAt: 'DateTime?',
  },
  raw_token_balances: {
    id: 'String @id',
    walletId: 'String',
    chain: 'String',
    tokenAddress: 'String',
    rawBalance: 'String',
    rawDecimals: 'Int',
    snapshotAt: 'DateTime',
    provider: 'String',
    ingestedAt: 'DateTime @default(now())',
  }
}