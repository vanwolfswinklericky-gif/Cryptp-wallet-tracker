# 🚀 Crypto Wallet Tracker API Documentation

## Enterprise-Grade REST API for Blockchain Data

**Version:** 1.0.0  
**Base URL:** `https://cryptp-wallet-tracker-gldn.vercel.app/api/v1`  
**Status:** Production Ready  
**Rate Limit:** 60 requests per minute per IP

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Rate Limiting](#rate-limiting)
4. [Endpoints](#endpoints)
   - [Health Check](#health-check)
   - [Get Wallet Data](#get-wallet-data)
   - [Get Token Prices](#get-token-prices)
   - [Get NFTs](#get-nfts)
   - [Check NFTs](#check-nfts)
5. [Error Handling](#error-handling)
6. [Rate Limit Headers](#rate-limit-headers)
7. [Examples](#examples)
8. [Supported Chains](#supported-chains)
9. [Best Practices](#best-practices)

---

## 📖 Overview

The Crypto Wallet Tracker API provides real-time blockchain data including wallet balances, transactions, token holdings, NFT collections, and live cryptocurrency prices. Built with enterprise-grade architecture, it features caching, rate limiting, and comprehensive error handling.

### Key Features

- ✅ **Real-time Data** - Live blockchain data via Etherscan and Alchemy
- ✅ **Multi-Chain Support** - Ethereum, Polygon, BSC, Arbitrum, Optimism, Avalanche, Base
- ✅ **Comprehensive Wallet Data** - Balances, transactions, tokens, and NFTs
- ✅ **Live Prices** - Real-time token prices from multiple sources
- ✅ **Enterprise Caching** - 60-second TTL for optimal performance
- ✅ **Rate Limiting** - 60 requests per minute to prevent abuse
- ✅ **Pagination** - Handle large datasets efficiently
- ✅ **Consistent Responses** - Standardized JSON responses

---

## 🔐 Authentication

**Currently, the API is open and does not require authentication.** 

Future versions may include API key-based authentication. For now, all endpoints are publicly accessible.

---

## 🚦 Rate Limiting

To ensure fair usage and prevent abuse, the API implements rate limiting:

| Parameter | Value |
|-----------|-------|
| **Requests per minute** | 60 |
| **Window** | 60 seconds |
| **Scope** | Per IP address |
| **Headers** | Included in every response |

### Rate Limit Headers

| Header | Description | Example |
|--------|-------------|---------|
| `X-RateLimit-Limit` | Maximum requests per minute | `60` |
| `X-RateLimit-Remaining` | Remaining requests in the window | `45` |
| `X-RateLimit-Reset` | Seconds until rate limit resets | `30` |

When rate limited (status code 429):
```json
{
  "success": false,
  "error": "Rate limit exceeded. Please wait and try again.",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "statusCode": 429
}
```

---

## 📡 Endpoints

---

### 🏥 Health Check

Verify the API is operational.

**Endpoint:** `GET /health`

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "version": "1.0.0"
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "statusCode": 200
}
```

**Example:**
```bash
curl https://cryptp-wallet-tracker-gldn.vercel.app/api/v1/health
```

---

### 👛 Get Wallet Data

Retrieve comprehensive wallet data including balance, transactions, tokens, and NFTs.

**Endpoint:** `GET /wallet/{address}`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | string | ✅ Yes | Wallet address (Ethereum format: 0x...) |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `chain` | string | `ethereum` | Blockchain: `ethereum`, `polygon`, `bsc`, `arbitrum`, `optimism`, `avalanche`, `base` |
| `includeTxs` | boolean | `true` | Include transaction history |
| `includeTokens` | boolean | `true` | Include ERC-20 token holdings |
| `includeNFTs` | boolean | `true` | Include NFT collections |
| `limit` | number | `20` | Items per page (max: `100`) |
| `offset` | number | `0` | Pagination offset |

**Example Request:**
```bash
curl "https://cryptp-wallet-tracker-gldn.vercel.app/api/v1/wallet/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045?chain=ethereum&limit=10&offset=0"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    "chain": "ethereum",
    "balance": 6.633494,
    "balanceFormatted": "6.633494",
    "symbol": "ETH",
    "transactions": [
      {
        "hash": "0x3711e90ac3014fff2bd0dc39a94c3cd717700ec5768a1eec8ed5813fbf6be3fb",
        "from": "0x0a375fcf1f6338e63c990792382f7678ae6d3357",
        "to": "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
        "value": "50000000000000",
        "valueFormatted": "0.000050",
        "timeStamp": "1785749423",
        "date": "2026-08-03T09:30:23.000Z",
        "status": "success",
        "gasUsed": "21062",
        "gasPrice": "668902505"
      }
    ],
    "transactionsCount": 10,
    "tokens": [
      {
        "contractAddress": "0xae42f183554d369ee98b7b1980bea3761f47abc3",
        "tokenName": "Ten Commandments",
        "tokenSymbol": "CMD",
        "decimals": 18,
        "balance": "0",
        "balanceFormatted": "0.000000",
        "price": 0,
        "value": 0
      }
    ],
    "nfts": [
      {
        "contractAddress": "0x...",
        "tokenId": "12345",
        "title": "My NFT",
        "description": "An amazing NFT",
        "imageUrl": "https://...",
        "collectionName": "My Collection",
        "collectionSymbol": "MC",
        "floorPrice": 0.5,
        "owner": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        "chain": "ethereum"
      }
    ]
  },
  "timestamp": "2026-08-14T10:00:00.000Z",
  "statusCode": 200,
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 10,
    "hasMore": false
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Invalid wallet address format",
  "timestamp": "2026-08-14T10:00:00.000Z",
  "statusCode": 400
}
```

---

### 💰 Get Token Prices

Fetch real-time prices for multiple tokens.

**Endpoint:** `GET /prices`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `symbols` | string | ✅ Yes | Comma-separated list of token symbols (max 100) |

**Example Request:**
```bash
curl "https://cryptp-wallet-tracker-gldn.vercel.app/api/v1/prices?symbols=ETH,USDC,WBTC,LINK,UNI,MATIC,BNB,ARB,OP,AVAX"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ETH": 3200.50,
    "USDC": 1.00,
    "WBTC": 61000.00,
    "LINK": 14.20,
    "UNI": 7.85,
    "MATIC": 0.50,
    "BNB": 580.00,
    "ARB": 0.75,
    "OP": 1.80,
    "AVAX": 28.00
  },
  "timestamp": "2026-08-14T10:00:00.000Z",
  "statusCode": 200
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "At least one symbol is required",
  "timestamp": "2026-08-14T10:00:00.000Z",
  "statusCode": 400
}
```

---

### 🖼️ Get NFTs

Retrieve all NFTs owned by a wallet.

**Endpoint:** `GET /nfts`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | string | ✅ Yes | Wallet address (Ethereum format: 0x...) |
| `chain` | string | ❌ No | Blockchain (default: `ethereum`) |

**Example Request:**
```bash
curl "https://cryptp-wallet-tracker-gldn.vercel.app/api/v1/nfts?address=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045&chain=ethereum"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    "chain": "ethereum",
    "nfts": [
      {
        "contractAddress": "0x...",
        "tokenId": "12345",
        "title": "My NFT",
        "description": "An amazing NFT",
        "imageUrl": "https://...",
        "collectionName": "My Collection",
        "collectionSymbol": "MC",
        "floorPrice": 0.5,
        "owner": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        "chain": "ethereum",
        "attributes": [
          {
            "trait_type": "Color",
            "value": "Blue"
          }
        ]
      }
    ],
    "count": 1
  },
  "timestamp": "2026-08-14T10:00:00.000Z",
  "statusCode": 200
}
```

---

### ✅ Check NFTs

Quickly check if a wallet has any NFTs.

**Endpoint:** `GET /nfts?action=check`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | string | ✅ Yes | Wallet address (Ethereum format: 0x...) |
| `chain` | string | ❌ No | Blockchain (default: `ethereum`) |

**Example Request:**
```bash
curl "https://cryptp-wallet-tracker-gldn.vercel.app/api/v1/nfts?action=check&address=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
```

**Response (has NFTs):**
```json
{
  "success": true,
  "data": {
    "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    "chain": "ethereum",
    "hasNFTs": true,
    "count": 5
  },
  "timestamp": "2026-08-14T10:00:00.000Z",
  "statusCode": 200
}
```

**Response (no NFTs):**
```json
{
  "success": true,
  "data": {
    "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    "chain": "ethereum",
    "hasNFTs": false,
    "count": 0
  },
  "timestamp": "2026-08-14T10:00:00.000Z",
  "statusCode": 200
}
```

---

## ⚠️ Error Handling

### Standard Error Response

All errors follow this structure:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "timestamp": "2026-08-14T10:00:00.000Z",
  "statusCode": 400
}
```

### HTTP Status Codes

| Code | Description | When It Happens |
|------|-------------|-----------------|
| **200** | Success | Request completed successfully |
| **400** | Bad Request | Invalid parameters or address format |
| **429** | Rate Limited | Too many requests per minute |
| **500** | Internal Server Error | Server-side error |
| **404** | Not Found | Endpoint not found |

### Common Error Messages

| Error Message | Cause | Solution |
|---------------|-------|----------|
| `Invalid wallet address format` | Address doesn't match required format | Verify the address is correct |
| `Wallet address is required` | Missing address parameter | Include address in the request |
| `At least one symbol is required` | Missing symbols parameter | Add symbols to the request |
| `Rate limit exceeded` | Too many requests | Wait for the rate limit to reset |
| `Invalid chain` | Unsupported blockchain | Use one of: ethereum, polygon, bsc, etc. |
| `Maximum 100 symbols allowed` | Too many symbols in request | Limit to 100 symbols per request |

---

## 📊 Rate Limit Headers

Every response includes rate limit headers to help you manage your usage:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 30
```

### Usage Example with Headers

```bash
curl -i "https://cryptp-wallet-tracker-gldn.vercel.app/api/v1/wallet/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
```

Response headers:
```
HTTP/2 200
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 58
```

---

## 🧪 Examples

### JavaScript/TypeScript

```typescript
// Get wallet data
async function getWallet(address: string) {
  const response = await fetch(
    `https://cryptp-wallet-tracker-gldn.vercel.app/api/v1/wallet/${address}?chain=ethereum`
  );
  const data = await response.json();
  
  if (data.success) {
    console.log(`Balance: ${data.data.balanceFormatted} ${data.data.symbol}`);
    console.log(`Transactions: ${data.data.transactionsCount}`);
    return data.data;
  } else {
    console.error(`Error: ${data.error}`);
  }
}

// Get prices
async function getPrices(symbols: string[]) {
  const response = await fetch(
    `https://cryptp-wallet-tracker-gldn.vercel.app/api/v1/prices?symbols=${symbols.join(',')}`
  );
  const data = await response.json();
  
  if (data.success) {
    Object.entries(data.data).forEach(([symbol, price]) => {
      console.log(`${symbol}: $${price}`);
    });
    return data.data;
  }
}

// Get NFTs
async function getNFTs(address: string) {
  const response = await fetch(
    `https://cryptp-wallet-tracker-gldn.vercel.app/api/v1/nfts?address=${address}`
  );
  const data = await response.json();
  
  if (data.success) {
    console.log(`Found ${data.data.count} NFTs`);
    return data.data.nfts;
  }
}

// Usage
getWallet('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
getPrices(['ETH', 'USDC', 'WBTC']);
getNFTs('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
```

### Python

```python
import requests

BASE_URL = "https://cryptp-wallet-tracker-gldn.vercel.app/api/v1"

def get_wallet(address, chain="ethereum"):
    response = requests.get(
        f"{BASE_URL}/wallet/{address}",
        params={"chain": chain, "includeTxs": True}
    )
    
    if response.status_code == 200:
        data = response.json()
        if data["success"]:
            return data["data"]
    return None

def get_prices(symbols):
    response = requests.get(
        f"{BASE_URL}/prices",
        params={"symbols": ",".join(symbols)}
    )
    
    if response.status_code == 200:
        data = response.json()
        if data["success"]:
            return data["data"]
    return None

# Usage
wallet = get_wallet("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
print(f"Balance: {wallet['balanceFormatted']} {wallet['symbol']}")

prices = get_prices(["ETH", "USDC", "WBTC"])
print(prices)
```

### cURL

```bash
# Health check
curl https://cryptp-wallet-tracker-gldn.vercel.app/api/v1/health

# Get wallet
curl "https://cryptp-wallet-tracker-gldn.vercel.app/api/v1/wallet/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045?chain=ethereum"

# Get prices
curl "https://cryptp-wallet-tracker-gldn.vercel.app/api/v1/prices?symbols=ETH,USDC,WBTC"

# Get NFTs
curl "https://cryptp-wallet-tracker-gldn.vercel.app/api/v1/nfts?address=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"

# Check NFTs
curl "https://cryptp-wallet-tracker-gldn.vercel.app/api/v1/nfts?action=check&address=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"

# Include rate limit headers
curl -i "https://cryptp-wallet-tracker-gldn.vercel.app/api/v1/wallet/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
```

---

## 🌐 Supported Chains

| Chain | Chain ID | Symbol | Explorer |
|-------|----------|--------|----------|
| **Ethereum** | 1 | ETH | etherscan.io |
| **Polygon** | 137 | MATIC | polygonscan.com |
| **BSC** | 56 | BNB | bscscan.com |
| **Arbitrum** | 42161 | ETH | arbiscan.io |
| **Optimism** | 10 | ETH | optimistic.etherscan.io |
| **Avalanche** | 43114 | AVAX | snowtrace.io |
| **Base** | 8453 | ETH | basescan.org |

---

## 📈 Best Practices

### 1. **Handle Rate Limiting Gracefully**

```typescript
async function fetchWithRetry(url: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url);
    
    if (response.status === 429) {
      const resetTime = parseInt(response.headers.get('X-RateLimit-Reset') || '60');
      console.log(`Rate limited. Waiting ${resetTime} seconds...`);
      await new Promise(resolve => setTimeout(resolve, resetTime * 1000));
      continue;
    }
    
    return response;
  }
  throw new Error('Max retries exceeded');
}
```

### 2. **Cache Responses**

```typescript
const cache = new Map();

async function cachedFetch(url: string, ttl = 60) {
  const key = url;
  const cached = cache.get(key);
  
  if (cached && Date.now() - cached.timestamp < ttl * 1000) {
    return cached.data;
  }
  
  const response = await fetch(url);
  const data = await response.json();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}
```

### 3. **Use Pagination**

```typescript
async function getAllTransactions(address: string) {
  let allTxs = [];
  let offset = 0;
  const limit = 20;
  let hasMore = true;
  
  while (hasMore) {
    const response = await fetch(
      `/api/v1/wallet/${address}?limit=${limit}&offset=${offset}&includeTxs=true`
    );
    const data = await response.json();
    
    if (data.success && data.data.transactions) {
      allTxs = allTxs.concat(data.data.transactions);
      hasMore = data.pagination?.hasMore || false;
      offset += limit;
    } else {
      break;
    }
  }
  
  return allTxs;
}
```

### 4. **Batch Price Requests**

```typescript
// ✅ Good - Batch tokens together
const prices = await getPrices(['ETH', 'USDC', 'WBTC', 'LINK', 'UNI']);

// ❌ Bad - Multiple separate requests
// const eth = await getPrice('ETH');
// const usdc = await getPrice('USDC');
// const wbtc = await getPrice('WBTC');
```

### 5. **Handle Errors Gracefully**

```typescript
async function safeApiCall<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    console.error('API Error:', error);
    return null;
  }
}

// Usage
const wallet = await safeApiCall(() => getWallet(address));
if (wallet) {
  // Use wallet data
} else {
  // Show fallback UI
}
```

---

## 📝 Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-08-14 | Initial release with wallet, prices, and NFT endpoints |

---

## 📧 Support

For issues or questions, please open an issue on the GitHub repository.

---

**© 2026 Crypto Wallet Tracker. All rights reserved.**