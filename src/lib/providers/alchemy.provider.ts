// src/lib/providers/alchemy.provider.ts
import { BlockchainProvider, Transaction, TokenBalance, WalletHistory } from './provider.interface';
import { Alchemy, Network, AlchemySettings } from 'alchemy-sdk';
import { ethers } from 'ethers';

export class AlchemyProvider implements BlockchainProvider {
  name = 'alchemy';
  chain: string;
  private client: Alchemy;
  private provider: ethers.providers.JsonRpcProvider;

  constructor(chain: string, apiKey: string) {
    this.chain = chain;
    this.client = new Alchemy({
      apiKey,
      network: this.getNetwork(chain),
    });
    this.provider = new ethers.providers.JsonRpcProvider(
      `https://${chain}.g.alchemy.com/v2/${apiKey}`
    );
  }

  private getNetwork(chain: string): Network {
    const map: Record<string, Network> = {
      ethereum: Network.ETH_MAINNET,
      polygon: Network.MATIC_MAINNET,
      arbitrum: Network.ARB_MAINNET,
      optimism: Network.OPT_MAINNET,
      base: Network.BASE_MAINNET,
    };
    return map[chain] || Network.ETH_MAINNET;
  }

  async getWalletTransactions(wallet: string, fromBlock?: number, toBlock?: number): Promise<Transaction[]> {
    const response = await this.client.core.getAssetTransfers({
      fromBlock: fromBlock ? `0x${fromBlock.toString(16)}` : '0x0',
      toBlock: toBlock ? `0x${toBlock.toString(16)}` : 'latest',
      fromAddress: wallet,
      excludeZeroValue: true,
      category: ['external', 'internal', 'erc20', 'erc721', 'erc1155'],
    });

    return response.transfers.map((tx: any) => ({
      hash: tx.hash,
      blockNumber: parseInt(tx.blockNum, 16),
      timestamp: new Date(parseInt(tx.metadata?.blockTimestamp || '0', 10) * 1000),
      from: tx.from,
      to: tx.to,
      value: tx.value || '0',
      gasUsed: tx.gasUsed || '0',
      gasPrice: tx.gasPrice || '0',
      status: 'success',
    }));
  }

  async getWalletTokenBalances(wallet: string): Promise<TokenBalance[]> {
    const response = await this.client.core.getTokenBalances(wallet);
    
    const balances: TokenBalance[] = [];
    for (const token of response.tokenBalances) {
      if (token.tokenBalance && token.tokenBalance !== '0') {
        const metadata = await this.client.core.getTokenMetadata(token.contractAddress);
        balances.push({
          tokenAddress: token.contractAddress,
          tokenSymbol: metadata.symbol || 'Unknown',
          tokenName: metadata.name || 'Unknown Token',
          balance: token.tokenBalance,
          decimals: metadata.decimals || 18,
          valueUsd: await this.getTokenPrice(token.contractAddress) * 
                    parseFloat(token.tokenBalance) / Math.pow(10, metadata.decimals || 18),
        });
      }
    }
    return balances;
  }

  async getTokenPrice(tokenAddress: string): Promise<number> {
    try {
      const response = await this.client.core.getTokenPrice(tokenAddress);
      return response?.prices?.[0]?.value || 0;
    } catch {
      return 0;
    }
  }

  async getTokenMetadata(tokenAddress: string) {
    return this.client.core.getTokenMetadata(tokenAddress);
  }

  async getWalletHistory(wallet: string, fromDate?: Date): Promise<WalletHistory> {
    const transactions = await this.getWalletTransactions(wallet);
    const tokenBalances = await this.getWalletTokenBalances(wallet);
    
    const totalValue = tokenBalances.reduce((sum, token) => sum + (token.valueUsd || 0), 0);
    
    return {
      address: wallet,
      chain: this.chain,
      firstSeen: new Date(),
      lastSeen: new Date(),
      transactions,
      tokenBalances,
      nfts: [],
      totalValueUsd: totalValue,
    };
  }

  async getTransaction(txHash: string) {
    const tx = await this.provider.getTransaction(txHash);
    const receipt = await this.provider.getTransactionReceipt(txHash);
    
    return {
      hash: tx.hash,
      blockNumber: tx.blockNumber,
      timestamp: new Date(),
      from: tx.from,
      to: tx.to || '',
      value: tx.value.toString(),
      gasUsed: receipt?.gasUsed.toString() || '0',
      gasPrice: tx.gasPrice?.toString() || '0',
      status: receipt?.status === 1 ? 'success' : 'failed',
    };
  }

  async setupWebhook(config: any) {
    // Alchemy webhook setup
    const webhook = await this.client.notify.createWebhook(config.url, config.type, {
      network: this.getNetwork(this.chain),
      addresses: config.addresses,
    });
    return { id: webhook.id, url: webhook.url };
  }

  async processWebhook(payload: any): Promise<any> {
    // Process Alchemy webhook payload
    return {
      type: 'transaction',
      hash: payload.event?.data?.block?.transactions?.[0]?.hash,
      // ... parse Alchemy webhook
    };
  }
}