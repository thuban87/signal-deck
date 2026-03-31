import { useQuery } from '@tanstack/react-query';
import { get } from '../api/client';

export default function useConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: () => get('/api/config'),
    staleTime: Infinity,
  });
}
