export interface WalletRequestParams {
  address: string;
  chain?: string;
  includeTxs?: boolean;
  includeTokens?: boolean;
  includeNFTs?: boolean;
  limit?: number;
  offset?: number;
}

export interface WalletRequest {
  params: WalletRequestParams;
  query: {
    chain?: string;
    includeTxs?: string;
    includeTokens?: string;
    includeNFTs?: string;
    limit?: string;
    offset?: string;
  };
}

export function validateWalletAddress(address: string): { valid: boolean; error?: string } {
  if (!address) {
    return { valid: false, error: 'Wallet address is required' };
  }

  const cleanAddress = address.trim();
  
  const isEthereum = /^0x[a-fA-F0-9]{40}$/i.test(cleanAddress);
  const isSolana = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(cleanAddress);
  const isBitcoin = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(cleanAddress) || 
                    /^bc1[a-zA-Z0-9]{39,59}$/.test(cleanAddress);

  if (!isEthereum && !isSolana && !isBitcoin) {
    return { 
      valid: false, 
      error: 'Invalid wallet address format' 
    };
  }

  return { valid: true };
}

export function validateChain(chain: string): { valid: boolean; error?: string } {
  const validChains = [
    'ethereum', 'polygon', 'bsc', 'arbitrum', 
    'optimism', 'avalanche', 'base', 'solana', 'bitcoin'
  ];

  if (!chain) {
    return { valid: true };
  }

  if (!validChains.includes(chain.toLowerCase())) {
    return { 
      valid: false, 
      error: `Invalid chain. Must be one of: ${validChains.join(', ')}` 
    };
  }

  return { valid: true };
}

export function validateLimit(limit?: string): { valid: boolean; value: number; error?: string } {
  const defaultLimit = 50;
  const maxLimit = 100;

  if (!limit) {
    return { valid: true, value: defaultLimit };
  }

  const parsed = parseInt(limit, 10);
  
  if (isNaN(parsed) || parsed < 1) {
    return { valid: false, value: defaultLimit, error: 'Limit must be a positive number' };
  }

  if (parsed > maxLimit) {
    return { valid: false, value: maxLimit, error: `Limit cannot exceed ${maxLimit}` };
  }

  return { valid: true, value: parsed };
}

export function validateOffset(offset?: string): { valid: boolean; value: number; error?: string } {
  const defaultOffset = 0;

  if (!offset) {
    return { valid: true, value: defaultOffset };
  }

  const parsed = parseInt(offset, 10);
  
  if (isNaN(parsed) || parsed < 0) {
    return { valid: false, value: defaultOffset, error: 'Offset must be a non-negative number' };
  }

  return { valid: true, value: parsed };
}