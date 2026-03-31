import { useQuery } from '@tanstack/react-query';
import { get } from '../api/client';

export function usePerformanceSummary(period = 'all') {
  return useQuery({
    queryKey: ['performance-summary', period],
    queryFn: () => get(`/api/performance/summary?period=${period}`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useEquityCurve(period = 'all') {
  return useQuery({
    queryKey: ['equity-curve', period],
    queryFn: () => get(`/api/performance/equity-curve?period=${period}`),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePerformanceByTag(period = 'all') {
  return useQuery({
    queryKey: ['performance-by-tag', period],
    queryFn: () => get(`/api/performance/by-tag?period=${period}`),
    staleTime: 5 * 60 * 1000,
  });
}
