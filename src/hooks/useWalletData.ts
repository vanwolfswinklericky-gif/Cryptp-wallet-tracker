import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

export function useWalletData(address: string) {
  return useQuery({
    queryKey: ['wallet', address],
    queryFn: async () => {
      const response = await axios.get(`/api/wallet/${address}`);
      return response.data;
    },
    enabled: !!address,
    refetchInterval: 60000, // Refresh every 60 seconds
  });
}

export function useWalletHoldings(address: string) {
  return useQuery({
    queryKey: ['holdings', address],
    queryFn: async () => {
      const response = await axios.get(`/api/wallet/holdings?address=${address}`);
      return response.data;
    },
    enabled: !!address,
    refetchInterval: 60000,
  });
}