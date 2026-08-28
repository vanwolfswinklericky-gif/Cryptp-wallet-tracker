// src/lib/providers/provider.interface.ts
export interface BlockchainProvider {
  name: string;
  chain: string;
  
  // Wallet data
  getWalletTransactions(wallet: string, fromBlock?: number, toBlock?: number): Promise<Transaction[]>;
  getWalletTokenBalances(wallet: string): Promise<TokenBalance[]>;
  getWalletNFTs(wallet: string): Promise<NFT[]>;
  getWalletHistory(wallet: string, fromDate?: Date): Promise<WalletHistory>;
  
  // Token data
  getTokenPrice(tokenAddress: string): Promise<number>;
  getTokenMetadata(tokenAddress: string): Promise<TokenMetadata>;
  
  // Transaction data
  getTransaction(txHash: string): Promise<TransactionDetails>;
  
  // Webhooks
  setupWebhook(config: WebhookConfig): Promise<WebhookResponse>;
  processWebhook(payload: any): Promise<WebhookEvent>;
}

export interface Transaction {
  hash: string;
  blockNumber: number;
  timestamp: Date;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  status: 'success' | 'failed' | 'pending';
  inputData?: string;
}

export interface TokenBalance {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  balance: string;
  decimals: number;
  valueUsd?: number;
}

export interface WalletHistory {
  address: string;
  chain: string;
  firstSeen: Date;
  lastSeen: Date;
  transactions: Transaction[];
  tokenBalances: TokenBalance[];
  nfts: NFT[];
  totalValueUsd: number;
}