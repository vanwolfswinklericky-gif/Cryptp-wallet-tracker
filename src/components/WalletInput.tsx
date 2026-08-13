'use client';

import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { CHAIN_OPTIONS } from '@/lib/etherscan';

interface Props {
  onAddressSubmit: (address: string, chain: string) => void;
  isLoading?: boolean;
}

export default function WalletInput({ onAddressSubmit, isLoading = false }: Props) {
  const [address, setAddress] = useState('');
  const [selectedChain, setSelectedChain] = useState('ethereum');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedAddress = address.trim();
    if (trimmedAddress) {
      onAddressSubmit(trimmedAddress, selectedChain);
    }
  };

  const testAddresses = [
    { label: 'Vitalik (ETH)', address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', chain: 'ethereum' },
    { label: 'Polygon Foundation', address: '0x8d12A197cB00D4747a1fe03395095ce2A5CC6819', chain: 'polygon' },
    { label: 'BSC Burn', address: '0x000000000000000000000000000000000000dEaD', chain: 'bsc' },
  ];

  const handleQuickTest = (testAddress: string, chain: string) => {
    setAddress(testAddress);
    setSelectedChain(chain);
    onAddressSubmit(testAddress, chain);
  };

  return (
    <form onSubmit={handleSubmit} className="cwt-wallet-form">
      <div className="cwt-wallet-row">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter wallet address (0x...)"
          disabled={isLoading}
          className="cwt-wallet-input"
        />
        <select
          value={selectedChain}
          onChange={(e) => setSelectedChain(e.target.value)}
          disabled={isLoading}
          className="cwt-wallet-select"
        >
          {CHAIN_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <button type="submit" disabled={isLoading || !address.trim()} className="cwt-wallet-button">
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading...
          </span>
        ) : (
          'Track Wallet'
        )}
      </button>

      <div className="cwt-wallet-tests">
        Quick Test:
        {testAddresses.map((test) => (
          <span key={test.label} onClick={() => handleQuickTest(test.address, test.chain)}>
            {test.label}
          </span>
        ))}
      </div>
    </form>
  );
}