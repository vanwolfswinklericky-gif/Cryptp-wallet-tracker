// src/lib/providers/moralis.provider.ts
import { BlockchainProvider, Transaction, TokenBalance, WalletHistory } from './provider.interface';
import Moralis from 'moralis';

export class MoralisProvider implements BlockchainProvider {
  name = 'moralis';
  chain: string;
  private apiKey: string;

  constructor(chain: string, apiKey: string) {
    this.chain = chain;
    this.apiKey = apiKey;
    if (!Moralis.Core.isStarted) {
      Moralis.start({ apiKey });
    }
  }

  private getChainId(): string {
    const map: Record<string, string> = {
      ethereum: '0x1',
      polygon: '0x89',
      bsc: '0x38',
      arbitrum: '0xa4b1',
      optimism: '0xa',
      base: '0x2105',
    };
    return map[this.chain] || '0x1';
  }

  async getWalletTransactions(wallet: string, fromBlock?: number, toBlock?: number): Promise<Transaction[]> {
    try {
      const response = await Moralis.EvmApi.transaction.getWalletTransactions({
        address: wallet,
        chain: this.getChainId(),
      });
      
      return response.result.map((tx: any) => ({
        hash: tx.hash,
        blockNumber: tx.blockNumber || 0,
        timestamp: new Date(tx.blockTimestamp || tx.timestamp),
        from: tx.fromAddress,
        to: tx.toAddress || '',
        value: tx.value || '0',
        gasUsed: tx.gas || '0',
        gasPrice: tx.gasPrice || '0',
        status: tx.receiptStatus === '1' ? 'success' : 'failed',
      }));
    } catch (error) {
      console.error('Moralis getWalletTransactions error:', error);
      return [];
    }
  }

  async getWalletTokenBalances(wallet: string): Promise<TokenBalance[]> {
    try {
      const response = await Moralis.EvmApi.token.getWalletTokenBalances({
        address: wallet,
        chain: this.getChainId(),
      });
      
      return response.result.map((token: any) => ({
        tokenAddress: token.tokenAddress,
        tokenSymbol: token.symbol || 'Unknown',
        tokenName: token.name || 'Unknown Token',
        balance: token.balance,
        decimals: token.decimals || 18,
        valueUsd: token.usdPrice ? parseFloat(token.balance) / Math.pow(10, token.decimals) * token.usdPrice : undefined,
      }));
    } catch (error) {
      console.error('Moralis getWalletTokenBalances error:', error);
      return [];
    }
  }

  async getWalletNFTs(wallet: string) {
    try {
      const response = await Moralis.EvmApi.nft.getWalletNFTs({
        address: wallet,
        chain: this.getChainId(),
      });
      return response.result;
    } catch (error) {
      console.error('Moralis getWalletNFTs error:', error);
      return [];
    }
  }

  async getWalletHistory(wallet: string, fromDate?: Date): Promise<WalletHistory> {
    const transactions = await this.getWalletTransactions(wallet);
    const tokenBalances = await this.getWalletTokenBalances(wallet);
    const nfts = await this.getWalletNFTs(wallet);
    
    const totalValue = tokenBalances.reduce((sum, token) => sum + (token.valueUsd || 0), 0);
    
    return {
      address: wallet,
      chain: this.chain,
      firstSeen: new Date(),
      lastSeen: new Date(),
      transactions,
      tokenBalances,
      nfts,
      totalValueUsd: totalValue,
    };
  }

  async getTokenPrice(tokenAddress: string): Promise<number> {
    try {
      const response = await Moralis.EvmApi.token.getTokenPrice({
        address: tokenAddress,
        chain: this.getChainId(),
      });
      return response.result?.usdPrice || 0;
    } catch {
      return 0;
    }
  }

  async getTokenMetadata(tokenAddress: string) {
    try {
      const response = await Moralis.EvmApi.token.getTokenMetadata({
        addresses: [tokenAddress],
        chain: this.getChainId(),
      });
      return response.result?.[0];
    } catch {
      return null;
    }
  }

  async getTransaction(txHash: string) {
    const response = await Moralis.EvmApi.transaction.getTransaction({
      transactionHash: txHash,
      chain: this.getChainId(),
    });
    return response.result;
  }

  async setupWebhook(config: any) {
    // Moralis stream setup
    const stream = await Moralis.Streams.add({
      webhookUrl: config.url,
      description: config.description || 'Wallet tracking',
      tag: config.tag || 'wallet-tracker',
      chains: [this.getChainId()],
      includeContractLogs: true,
      includeNativeTxs: true,
      includeInternalTxs: true,
      includeUserOps: true,
      addresses: config.addresses,
    });
    return { id: stream.id, url: stream.webhookUrl };
  }

  async processWebhook(payload: any): Promise<any> {
    // Process Moralis webhook payload
    return {
      type: 'transaction',
      hash: payload.txs?.[0]?.hash,
      // ... parse Moralis webhook
    };
  }
}