import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, del } from '../api/client';

export function useBaskets() {
  return useQuery({
    queryKey: ['baskets'],
    queryFn: () => get('/api/baskets'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useBasketMetrics(basketId) {
  return useQuery({
    queryKey: ['basket-metrics', basketId],
    queryFn: () => get(`/api/baskets/${basketId}/metrics`),
    staleTime: 5 * 60 * 1000,
    enabled: !!basketId,
  });
}

export function useCreateBasket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (basket) => post('/api/baskets', basket),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['baskets'] }),
  });
}

export function useDeleteBasket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => del(`/api/baskets/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['baskets'] }),
  });
}
