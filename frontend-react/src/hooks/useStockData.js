import { useQuery } from '@tanstack/react-query';
import { get } from '../api/client';

export default function useStockData(symbol, period = '6mo') {
  return useQuery({
    queryKey: ['stock', symbol, period],
    queryFn: () => get(`/api/stock/${symbol}?period=${period}`),
    staleTime: 5 * 60 * 1000,
    enabled: !!symbol,
  });
}
