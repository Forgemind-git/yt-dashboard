import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { useDateRange } from '../context/DateRangeContext';

export function useGrowthInsights({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['insights-growth'],
    queryFn: () => apiFetch('/insights/growth'),
    staleTime: 10 * 60 * 1000,
    enabled,
  });
}

export function useContentScore({ enabled = true } = {}) {
  const { from, to } = useDateRange();
  return useQuery({
    queryKey: ['insights-content-score', from, to],
    queryFn: () => apiFetch(`/insights/content-score?from=${from}&to=${to}`),
    staleTime: 10 * 60 * 1000,
    enabled,
  });
}

export function useUploadTiming({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['insights-upload-timing'],
    queryFn: () => apiFetch('/insights/upload-timing'),
    staleTime: 10 * 60 * 1000,
    enabled,
  });
}

export function useOutliers({ enabled = true } = {}) {
  const { from, to } = useDateRange();
  return useQuery({
    queryKey: ['insights-outliers', from, to],
    queryFn: () => apiFetch(`/insights/outliers?from=${from}&to=${to}`),
    staleTime: 10 * 60 * 1000,
    enabled,
  });
}

export function useInsightsSummary({ enabled = true } = {}) {
  const { from, to } = useDateRange();
  return useQuery({
    queryKey: ['insights-summary', from, to],
    queryFn: () => apiFetch(`/insights/summary?from=${from}&to=${to}`),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useRetention({ enabled = true } = {}) {
  const { from, to } = useDateRange();
  return useQuery({
    queryKey: ['insights-retention', from, to],
    queryFn: () => apiFetch(`/insights/retention?from=${from}&to=${to}`),
    staleTime: 10 * 60 * 1000,
    enabled,
  });
}

export function useTrafficROI({ enabled = true } = {}) {
  const { from, to } = useDateRange();
  return useQuery({
    queryKey: ['insights-traffic-roi', from, to],
    queryFn: () => apiFetch(`/insights/traffic-roi?from=${from}&to=${to}`),
    staleTime: 10 * 60 * 1000,
    enabled,
  });
}

export function useChannelHealth({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['insights-channel-health'],
    queryFn: () => apiFetch('/insights/channel-health'),
    staleTime: 10 * 60 * 1000,
    enabled,
  });
}

export function useRecommendations({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['insights-recommendations'],
    queryFn: () => apiFetch('/insights/recommendations'),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useLifecycle({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['insights-lifecycle'],
    queryFn: () => apiFetch('/insights/lifecycle'),
    staleTime: 10 * 60 * 1000,
    enabled,
  });
}

export function useContentPatterns({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['insights-content-patterns'],
    queryFn: () => apiFetch('/insights/content-patterns'),
    staleTime: 10 * 60 * 1000,
    enabled,
  });
}

export function useUploadGaps({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['insights-upload-gaps'],
    queryFn: () => apiFetch('/insights/upload-gaps'),
    staleTime: 10 * 60 * 1000,
    enabled,
  });
}

export function useSubscriberQuality({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['insights-subscriber-quality'],
    queryFn: () => apiFetch('/insights/subscriber-quality'),
    staleTime: 10 * 60 * 1000,
    enabled,
  });
}

export function useGrowthBenchmark({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['insights-growth-benchmark'],
    queryFn: () => apiFetch('/insights/growth-benchmark'),
    staleTime: 10 * 60 * 1000,
    enabled,
  });
}

export function useSubscriberEngagement({ enabled = true } = {}) {
  const { from, to } = useDateRange();
  return useQuery({
    queryKey: ['insights-subscriber-engagement', from, to],
    queryFn: () => apiFetch(`/insights/subscriber-engagement?from=${from}&to=${to}`),
    staleTime: 10 * 60 * 1000,
    enabled,
  });
}
