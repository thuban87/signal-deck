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

export function usePaperOrdersFull(status = 'all', limit = 50, side = null) {
  const { data: config } = useConfig();
  const isAlpaca = config?.alpaca_connected;

  const params = new URLSearchParams({ status, limit: String(limit) });
  if (side) params.set('side', side);

  return useQuery({
    queryKey: ['paper-orders-full', status, limit, side],
    queryFn: () => get(`/api/paper/orders/full?${params}`),
    staleTime: 30 * 1000,
    enabled: config != null && isAlpaca === true,
  });
}

export function usePaperActivities(activityType = null, limit = 100) {
  const { data: config } = useConfig();
  const isAlpaca = config?.alpaca_connected;

  const params = new URLSearchParams({ limit: String(limit) });
  if (activityType) params.set('activity_type', activityType);

  return useQuery({
    queryKey: ['paper-activities', activityType, limit],
    queryFn: () => get(`/api/paper/activities?${params}`),
    staleTime: 60 * 1000,
    enabled: config != null && isAlpaca === true,
  });
}

export function usePaperConfigurations() {
  const { data: config } = useConfig();
  const isAlpaca = config?.alpaca_connected;

  return useQuery({
    queryKey: ['paper-configurations'],
    queryFn: () => get('/api/paper/configurations'),
    staleTime: 5 * 60 * 1000,
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
