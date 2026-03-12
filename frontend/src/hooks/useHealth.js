import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export function useCollectionLogs() {
  return useQuery({
    queryKey: ['collection-logs'],
    queryFn: () => apiFetch('/collection/logs'),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useTriggerCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch('/collect/trigger', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection-logs'] });
    },
  });
}
