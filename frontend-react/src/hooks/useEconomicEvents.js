import { useQuery } from '@tanstack/react-query';
import { get } from '../api/client';

export default function useEconomicEvents(days = 30) {
  return useQuery({
    queryKey: ['economic-events', days],
    queryFn: () => get(`/api/economic-events?days=${days}`),
    staleTime: 30 * 60 * 1000,
  });
}
