-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "Chain" AS ENUM ('ETHEREUM', 'POLYGON', 'BSC', 'ARBITRUM', 'OPTIMISM', 'AVALANCHE', 'BASE', 'SOLANA');

-- CreateEnum
CREATE TYPE "DexStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DexName" AS ENUM ('UNISWAP', 'UNISWAP_V3', 'PANCAKESWAP', 'QUICKSWAP', 'SUSHISWAP', 'ONEINCH', 'PARASWAP');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "emailVerified" TIMESTAMP(3),
    "passwordHash" TEXT,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "label" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isScam" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "userId" TEXT,
    "notes" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "lastScannedAt" TIMESTAMP(3),
    "scanCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletMetric" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalPnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRoi" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tradeCount" INTEGER NOT NULL DEFAULT 0,
    "winCount" INTEGER NOT NULL DEFAULT 0,
    "lossCount" INTEGER NOT NULL DEFAULT 0,
    "averageTrade" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bestTrade" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "worstTrade" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averageVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxDrawdown" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentDrawdown" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sharpeRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "volatility" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "walletScore" INTEGER NOT NULL DEFAULT 0,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "consistencyScore" INTEGER NOT NULL DEFAULT 0,
    "portfolioValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tokensCount" INTEGER NOT NULL DEFAULT 0,
    "nftsCount" INTEGER NOT NULL DEFAULT 0,
    "activeDays" INTEGER NOT NULL DEFAULT 0,
    "lastTrade" TIMESTAMP(3),
    "firstTrade" TIMESTAMP(3),
    "preferredTokens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredProtocols" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "performance24h" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "performance7d" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "performance30d" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "performance90d" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalGasUsed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averageGasPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "uniqueInteractions" INTEGER NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "WalletMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "fromAddress" TEXT,
    "toAddress" TEXT,
    "tokenAddress" TEXT,
    "tokenSymbol" TEXT,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valueUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockNumber" BIGINT,
    "transactionType" TEXT,
    "status" TEXT,
    "gasUsed" DOUBLE PRECISION,
    "gasPrice" DOUBLE PRECISION,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "isError" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "receipt" JSONB DEFAULT '{}',
    "decodedData" JSONB DEFAULT '{}',

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddressBookEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "chain" TEXT NOT NULL DEFAULT 'ETHEREUM',
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "lastUsedAt" TIMESTAMP(3),
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "walletId" TEXT,

    CONSTRAINT "AddressBookEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changes" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScannerFilter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT,
    "chain" "Chain",
    "minPnL" DOUBLE PRECISION,
    "maxPnL" DOUBLE PRECISION,
    "minWinRate" DOUBLE PRECISION,
    "minTrades" INTEGER,
    "minPerformance" DOUBLE PRECISION,
    "maxDrawdown" DOUBLE PRECISION,
    "minWalletScore" INTEGER,
    "preferredTokens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredProtocols" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "filter" JSONB DEFAULT '{}',

    CONSTRAINT "ScannerFilter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScannedWallet" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "scanId" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchedFilters" JSONB NOT NULL DEFAULT '{}',
    "scanDuration" INTEGER,
    "resultHash" TEXT,
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ScannedWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DexTrade" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "dexName" TEXT NOT NULL,
    "fromToken" TEXT NOT NULL,
    "fromSymbol" TEXT NOT NULL,
    "fromAmount" DOUBLE PRECISION NOT NULL,
    "toToken" TEXT NOT NULL,
    "toSymbol" TEXT NOT NULL,
    "toAmount" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION,
    "slippage" DOUBLE PRECISION,
    "gasUsed" DOUBLE PRECISION,
    "gasPrice" DOUBLE PRECISION,
    "status" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "DexTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DexRoute" (
    "id" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "dexName" TEXT NOT NULL,
    "fromToken" TEXT NOT NULL,
    "toToken" TEXT NOT NULL,
    "fromAmount" DOUBLE PRECISION NOT NULL,
    "toAmount" DOUBLE PRECISION NOT NULL,
    "priceImpact" DOUBLE PRECISION NOT NULL,
    "gasEstimate" DOUBLE PRECISION NOT NULL,
    "route" JSONB NOT NULL,
    "isOptimal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DexRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenPrice" (
    "id" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "priceUsd" DOUBLE PRECISION NOT NULL,
    "priceChange24h" DOUBLE PRECISION NOT NULL,
    "volume24h" DOUBLE PRECISION NOT NULL,
    "marketCap" DOUBLE PRECISION,
    "liquidity" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Token" (
    "id" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL DEFAULT 18,
    "logoURI" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "defaultSlippage" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "preferredDex" TEXT,
    "autoRouting" BOOLEAN NOT NULL DEFAULT true,
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "language" TEXT NOT NULL DEFAULT 'en',
    "notifications" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopyTradeAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "monitorBuy" BOOLEAN NOT NULL DEFAULT true,
    "monitorSell" BOOLEAN NOT NULL DEFAULT true,
    "monitorSwap" BOOLEAN NOT NULL DEFAULT true,
    "monitorSend" BOOLEAN NOT NULL DEFAULT false,
    "monitorReceive" BOOLEAN NOT NULL DEFAULT false,
    "minValueUsd" DOUBLE PRECISION,
    "maxValueUsd" DOUBLE PRECISION,
    "tokenWhitelist" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tokenBlacklist" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "webhookUrl" TEXT NOT NULL,
    "webhookSecret" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxAlertsPerDay" INTEGER NOT NULL DEFAULT 50,
    "alertsToday" INTEGER NOT NULL DEFAULT 0,
    "lastAlertAt" TIMESTAMP(3),
    "alertCooldown" INTEGER NOT NULL DEFAULT 60,
    "totalAlerts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CopyTradeAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopyTradeAlertLog" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "tokenName" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "valueUsd" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION,
    "portfolioPercentage" DOUBLE PRECISION,
    "fromAddress" TEXT,
    "toAddress" TEXT,
    "chain" TEXT NOT NULL,
    "webhookStatus" TEXT NOT NULL,
    "webhookResponse" TEXT,
    "webhookError" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CopyTradeAlertLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookQueue" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "nextRetryAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_address_key" ON "Wallet"("address");

-- CreateIndex
CREATE INDEX "Wallet_userId_isDeleted_idx" ON "Wallet"("userId", "isDeleted");

-- CreateIndex
CREATE INDEX "Wallet_address_chain_idx" ON "Wallet"("address", "chain");

-- CreateIndex
CREATE INDEX "Wallet_isFavorite_idx" ON "Wallet"("isFavorite");

-- CreateIndex
CREATE INDEX "Wallet_isArchived_idx" ON "Wallet"("isArchived");

-- CreateIndex
CREATE INDEX "Wallet_deletedAt_idx" ON "Wallet"("deletedAt");

-- CreateIndex
CREATE INDEX "Wallet_lastScannedAt_idx" ON "Wallet"("lastScannedAt");

-- CreateIndex
CREATE INDEX "WalletMetric_walletId_chain_timestamp_idx" ON "WalletMetric"("walletId", "chain", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "WalletMetric_walletScore_idx" ON "WalletMetric"("walletScore" DESC);

-- CreateIndex
CREATE INDEX "WalletMetric_performance7d_idx" ON "WalletMetric"("performance7d" DESC);

-- CreateIndex
CREATE INDEX "WalletMetric_performance30d_idx" ON "WalletMetric"("performance30d" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "WalletMetric_walletId_chain_timestamp_key" ON "WalletMetric"("walletId", "chain", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_hash_key" ON "WalletTransaction"("hash");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_timestamp_idx" ON "WalletTransaction"("walletId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "WalletTransaction_tokenAddress_timestamp_idx" ON "WalletTransaction"("tokenAddress", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "WalletTransaction_fromAddress_idx" ON "WalletTransaction"("fromAddress");

-- CreateIndex
CREATE INDEX "WalletTransaction_toAddress_idx" ON "WalletTransaction"("toAddress");

-- CreateIndex
CREATE INDEX "WalletTransaction_hash_idx" ON "WalletTransaction"("hash");

-- CreateIndex
CREATE INDEX "WalletTransaction_timestamp_idx" ON "WalletTransaction"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "WalletTransaction_isError_idx" ON "WalletTransaction"("isError");

-- CreateIndex
CREATE INDEX "AddressBookEntry_userId_name_idx" ON "AddressBookEntry"("userId", "name");

-- CreateIndex
CREATE INDEX "AddressBookEntry_userId_tags_idx" ON "AddressBookEntry"("userId", "tags");

-- CreateIndex
CREATE INDEX "AddressBookEntry_isFavorite_idx" ON "AddressBookEntry"("isFavorite");

-- CreateIndex
CREATE UNIQUE INDEX "AddressBookEntry_userId_address_chain_key" ON "AddressBookEntry"("userId", "address", "chain");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");

-- CreateIndex
CREATE INDEX "ApiKey_keyHash_idx" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_isRevoked_idx" ON "ApiKey"("isRevoked");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_isActive_idx" ON "Session"("isActive");

-- CreateIndex
CREATE INDEX "ScannerFilter_userId_idx" ON "ScannerFilter"("userId");

-- CreateIndex
CREATE INDEX "ScannerFilter_isPublic_idx" ON "ScannerFilter"("isPublic");

-- CreateIndex
CREATE INDEX "ScannerFilter_isActive_idx" ON "ScannerFilter"("isActive");

-- CreateIndex
CREATE INDEX "ScannerFilter_chain_idx" ON "ScannerFilter"("chain");

-- CreateIndex
CREATE INDEX "ScannerFilter_minWalletScore_idx" ON "ScannerFilter"("minWalletScore");

-- CreateIndex
CREATE INDEX "ScannerFilter_usageCount_idx" ON "ScannerFilter"("usageCount");

-- CreateIndex
CREATE UNIQUE INDEX "ScannerFilter_name_userId_key" ON "ScannerFilter"("name", "userId");

-- CreateIndex
CREATE INDEX "ScannedWallet_walletId_timestamp_idx" ON "ScannedWallet"("walletId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "ScannedWallet_score_idx" ON "ScannedWallet"("score" DESC);

-- CreateIndex
CREATE INDEX "ScannedWallet_scanId_idx" ON "ScannedWallet"("scanId");

-- CreateIndex
CREATE INDEX "ScannedWallet_isProcessed_idx" ON "ScannedWallet"("isProcessed");

-- CreateIndex
CREATE UNIQUE INDEX "DexTrade_txHash_key" ON "DexTrade"("txHash");

-- CreateIndex
CREATE INDEX "DexTrade_walletId_timestamp_idx" ON "DexTrade"("walletId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "DexTrade_txHash_idx" ON "DexTrade"("txHash");

-- CreateIndex
CREATE INDEX "DexTrade_chain_dexName_idx" ON "DexTrade"("chain", "dexName");

-- CreateIndex
CREATE INDEX "DexTrade_status_idx" ON "DexTrade"("status");

-- CreateIndex
CREATE INDEX "DexRoute_chain_fromToken_toToken_idx" ON "DexRoute"("chain", "fromToken", "toToken");

-- CreateIndex
CREATE INDEX "DexRoute_isOptimal_idx" ON "DexRoute"("isOptimal");

-- CreateIndex
CREATE INDEX "TokenPrice_chain_tokenAddress_timestamp_idx" ON "TokenPrice"("chain", "tokenAddress", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "TokenPrice_symbol_idx" ON "TokenPrice"("symbol");

-- CreateIndex
CREATE INDEX "TokenPrice_priceUsd_idx" ON "TokenPrice"("priceUsd");

-- CreateIndex
CREATE UNIQUE INDEX "TokenPrice_chain_tokenAddress_timestamp_key" ON "TokenPrice"("chain", "tokenAddress", "timestamp");

-- CreateIndex
CREATE INDEX "Token_chain_symbol_idx" ON "Token"("chain", "symbol");

-- CreateIndex
CREATE INDEX "Token_isVerified_idx" ON "Token"("isVerified");

-- CreateIndex
CREATE INDEX "Token_isDefault_idx" ON "Token"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "Token_chain_address_key" ON "Token"("chain", "address");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- CreateIndex
CREATE INDEX "UserPreference_userId_idx" ON "UserPreference"("userId");

-- CreateIndex
CREATE INDEX "CopyTradeAlert_userId_idx" ON "CopyTradeAlert"("userId");

-- CreateIndex
CREATE INDEX "CopyTradeAlert_walletId_idx" ON "CopyTradeAlert"("walletId");

-- CreateIndex
CREATE INDEX "CopyTradeAlert_isActive_idx" ON "CopyTradeAlert"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CopyTradeAlert_userId_walletId_key" ON "CopyTradeAlert"("userId", "walletId");

-- CreateIndex
CREATE INDEX "CopyTradeAlertLog_alertId_idx" ON "CopyTradeAlertLog"("alertId");

-- CreateIndex
CREATE INDEX "CopyTradeAlertLog_txHash_idx" ON "CopyTradeAlertLog"("txHash");

-- CreateIndex
CREATE INDEX "CopyTradeAlertLog_eventType_idx" ON "CopyTradeAlertLog"("eventType");

-- CreateIndex
CREATE INDEX "CopyTradeAlertLog_createdAt_idx" ON "CopyTradeAlertLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "CopyTradeAlertLog_webhookStatus_idx" ON "CopyTradeAlertLog"("webhookStatus");

-- CreateIndex
CREATE INDEX "WebhookQueue_status_idx" ON "WebhookQueue"("status");

-- CreateIndex
CREATE INDEX "WebhookQueue_nextRetryAt_idx" ON "WebhookQueue"("nextRetryAt");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletMetric" ADD CONSTRAINT "WalletMetric_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddressBookEntry" ADD CONSTRAINT "AddressBookEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddressBookEntry" ADD CONSTRAINT "AddressBookEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScannerFilter" ADD CONSTRAINT "ScannerFilter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScannedWallet" ADD CONSTRAINT "ScannedWallet_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DexTrade" ADD CONSTRAINT "DexTrade_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopyTradeAlert" ADD CONSTRAINT "CopyTradeAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopyTradeAlert" ADD CONSTRAINT "CopyTradeAlert_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopyTradeAlertLog" ADD CONSTRAINT "CopyTradeAlertLog_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "CopyTradeAlert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookQueue" ADD CONSTRAINT "WebhookQueue_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "CopyTradeAlert"("id") ON DELETE CASCADE ON UPDATE CASCADE;
