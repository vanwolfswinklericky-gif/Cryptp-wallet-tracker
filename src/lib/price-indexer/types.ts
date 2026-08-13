// src/lib/price-indexer/types.ts

export interface TokenPrice {
  symbol: string;
  address: string;
  price: number;
  priceChange24h: number;
  lastUpdated: number; // timestamp
  source: string;
}

export interface PriceCache {
  [address: string]: {
    price: number;
    timestamp: number;
    source: string;
  };
}