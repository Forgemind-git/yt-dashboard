import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export function useRealtime() {
  return useQuery({
    queryKey: ['realtime'],
    queryFn: () => apiFetch('/realtime'),
    refetchInterval: 15 * 60 * 1000, // Auto-refresh every 2 minutes
    staleTime: 30 * 1000,
  });
}
