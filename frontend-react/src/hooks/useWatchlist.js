import { useQuery } from '@tanstack/react-query';
import { get } from '../api/client';

export default function useWatchlist() {
  return useQuery({
    queryKey: ['watchlist'],
    queryFn: () => get('/api/watchlist'),
    staleTime: 2 * 60 * 1000,
  });
}
