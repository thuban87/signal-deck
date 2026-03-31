import { useQuery } from '@tanstack/react-query';
import { get } from '../api/client';
import useConfig from './useConfig';

export function usePaperAccount() {
  const { data: config } = useConfig();
  const isAlpaca = config?.alpaca_connected;

  return useQuery({
    queryKey: ['paper-account'],
    queryFn: () => get('/api/paper/account'),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    enabled: config != null && isAlpaca === true,
  });
}

export function usePaperPositions() {
  const { data: config } = useConfig();
  const isAlpaca = config?.alpaca_connected;

  return useQuery({
    queryKey: ['paper-positions', isAlpaca],
    queryFn: () => get(isAlpaca ? '/api/paper/positions' : '/api/paper/trades'),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    enabled: config != null,
  });
}

export function usePaperOrders() {
  const { data: config } = useConfig();
  const isAlpaca = config?.alpaca_connected;

  return useQuery({
    queryKey: ['paper-orders'],
    queryFn: () => get('/api/paper/orders/history'),
    staleTime: 30 * 1000,
    enabled: config != null && isAlpaca === true,
  });
}

export function usePortfolioHistory(period = '1M') {
  const { data: config } = useConfig();
  const isAlpaca = config?.alpaca_connected;

  return useQuery({
    queryKey: ['portfolio-history', period, isAlpaca],
    queryFn: () =>
      get(
        isAlpaca
          ? `/api/paper/portfolio-history?period=${period}`
          : `/api/paper/equity?period=${period}`
      ),
    staleTime: 60 * 1000,
    enabled: config != null,
  });
}
