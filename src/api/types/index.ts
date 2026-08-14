// src/api/types/index.ts

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  path?: string;
  statusCode: number;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export interface WalletData {
  address: string;
  chain: string;
  balance: number;
  balanceFormatted: string;
  symbol: string;
  transactions: Transaction[];
  transactionsCount: number;
  tokens: Token[];
  nfts?: NFT[];
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  valueFormatted: string;
  timeStamp: string;
  date: string;
  status: 'success' | 'pending' | 'failed';
  gasUsed?: string;
  gasPrice?: string;
}

export interface Token {
  contractAddress: string;
  tokenName: string;
  tokenSymbol: string;
  decimals: number;
  balance: string;
  balanceFormatted: string;
  price?: number;
  value?: number;
}

export interface NFT {
  contractAddress: string;
  tokenId: string;
  title: string;
  description: string;
  imageUrl: string;
  collectionName: string;
  collectionSymbol: string;
  floorPrice?: number;
  owner: string;
  chain: string;
  attributes?: Attribute[];
}

export interface Attribute {
  trait_type: string;
  value: string;
}

export interface PriceData {
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number;
  lastUpdated: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ChainConfig {
  id: number | string;
  name: string;
  symbol: string;
  explorer: string;
  rpcUrl: string;
  apiUrl: string;
  apiKey?: string;
}

export interface UserPreferences {
  currency: string;
  theme: 'light' | 'dark';
  refreshInterval: number;
  favoriteWallets: string[];
  notifications: boolean;
}