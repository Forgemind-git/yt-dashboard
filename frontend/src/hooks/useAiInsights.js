import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export function useAiAnalysisTypes() {
  return useQuery({
    queryKey: ['ai-insights-types'],
    queryFn: () => apiFetch('/ai-insights/types'),
    staleTime: 60 * 60 * 1000,
  });
}

export function useAiAnalysis(type) {
  return useQuery({
    queryKey: ['ai-insights', type],
    queryFn: () => apiFetch(`/ai-insights/${type}`),
    staleTime: 30 * 60 * 1000,
    enabled: !!type,
    retry: 1,
  });
}

export function useSmartNotifications() {
  return useQuery({
    queryKey: ['ai-notifications'],
    queryFn: () => apiFetch('/ai-insights/notifications'),
    staleTime: 15 * 60 * 1000,
  });
}

export function useGenerateAllAnalyses() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch('/ai-insights/generate-all', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-insights'] });
    },
  });
}

export function useRefreshAnalysis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (type) =>
      apiFetch('/ai-insights/refresh', {
        method: 'POST',
        body: JSON.stringify({ type }),
      }),
    onSuccess: (_, type) => {
      if (type) queryClient.invalidateQueries({ queryKey: ['ai-insights', type] });
      else queryClient.invalidateQueries({ queryKey: ['ai-insights'] });
    },
  });
}

export function useAiChat() {
  return useMutation({
    mutationFn: ({ question, history }) =>
      apiFetch('/ai-insights/chat', {
        method: 'POST',
        body: JSON.stringify({ question, history }),
      }),
  });
}

export function useGenerateTitles() {
  return useMutation({
    mutationFn: (topic) =>
      apiFetch('/ai-insights/generate-titles', {
        method: 'POST',
        body: JSON.stringify({ topic }),
      }),
  });
}
