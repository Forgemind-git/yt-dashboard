import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

const API = import.meta.env.VITE_API_URL || '/api';

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
    mutationFn: () =>
      fetch(`${API}/ai-insights/generate-all`, { method: 'POST' }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-insights'] });
    },
  });
}

export function useRefreshAnalysis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (type) =>
      fetch(`${API}/ai-insights/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      }).then(r => r.json()),
    onSuccess: (_, type) => {
      if (type) queryClient.invalidateQueries({ queryKey: ['ai-insights', type] });
      else queryClient.invalidateQueries({ queryKey: ['ai-insights'] });
    },
  });
}

export function useAiChat() {
  return useMutation({
    mutationFn: ({ question, history }) =>
      fetch(`${API}/ai-insights/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history }),
      }).then(r => r.json()),
  });
}

export function useGenerateTitles() {
  return useMutation({
    mutationFn: (topic) =>
      fetch(`${API}/ai-insights/generate-titles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      }).then(r => r.json()),
  });
}
