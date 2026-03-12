import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { useDateRange } from '../context/DateRangeContext';

export function useGrowthInsights() {
  return useQuery({
    queryKey: ['insights-growth'],
    queryFn: () => apiFetch('/insights/growth'),
    staleTime: 10 * 60 * 1000,
  });
}

export function useContentScore() {
  const { from, to } = useDateRange();
  return useQuery({
    queryKey: ['insights-content-score', from, to],
    queryFn: () => apiFetch(`/insights/content-score?from=${from}&to=${to}`),
    staleTime: 10 * 60 * 1000,
  });
}

export function useUploadTiming() {
  return useQuery({
    queryKey: ['insights-upload-timing'],
    queryFn: () => apiFetch('/insights/upload-timing'),
    staleTime: 10 * 60 * 1000,
  });
}

export function useOutliers() {
  const { from, to } = useDateRange();
  return useQuery({
    queryKey: ['insights-outliers', from, to],
    queryFn: () => apiFetch(`/insights/outliers?from=${from}&to=${to}`),
    staleTime: 10 * 60 * 1000,
  });
}

export function useInsightsSummary() {
  const { from, to } = useDateRange();
  return useQuery({
    queryKey: ['insights-summary', from, to],
    queryFn: () => apiFetch(`/insights/summary?from=${from}&to=${to}`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useRetention() {
  const { from, to } = useDateRange();
  return useQuery({
    queryKey: ['insights-retention', from, to],
    queryFn: () => apiFetch(`/insights/retention?from=${from}&to=${to}`),
    staleTime: 10 * 60 * 1000,
  });
}

export function useTrafficROI() {
  const { from, to } = useDateRange();
  return useQuery({
    queryKey: ['insights-traffic-roi', from, to],
    queryFn: () => apiFetch(`/insights/traffic-roi?from=${from}&to=${to}`),
    staleTime: 10 * 60 * 1000,
  });
}

export function useChannelHealth() {
  return useQuery({
    queryKey: ['insights-channel-health'],
    queryFn: () => apiFetch('/insights/channel-health'),
    staleTime: 10 * 60 * 1000,
  });
}

export function useRecommendations() {
  return useQuery({
    queryKey: ['insights-recommendations'],
    queryFn: () => apiFetch('/insights/recommendations'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useLifecycle() {
  return useQuery({
    queryKey: ['insights-lifecycle'],
    queryFn: () => apiFetch('/insights/lifecycle'),
    staleTime: 10 * 60 * 1000,
  });
}

export function useContentPatterns() {
  return useQuery({
    queryKey: ['insights-content-patterns'],
    queryFn: () => apiFetch('/insights/content-patterns'),
    staleTime: 10 * 60 * 1000,
  });
}

export function useUploadGaps() {
  return useQuery({
    queryKey: ['insights-upload-gaps'],
    queryFn: () => apiFetch('/insights/upload-gaps'),
    staleTime: 10 * 60 * 1000,
  });
}

export function useSubscriberQuality() {
  return useQuery({
    queryKey: ['insights-subscriber-quality'],
    queryFn: () => apiFetch('/insights/subscriber-quality'),
    staleTime: 10 * 60 * 1000,
  });
}

export function useGrowthBenchmark() {
  return useQuery({
    queryKey: ['insights-growth-benchmark'],
    queryFn: () => apiFetch('/insights/growth-benchmark'),
    staleTime: 10 * 60 * 1000,
  });
}

export function useSubscriberEngagement() {
  const { from, to } = useDateRange();
  return useQuery({
    queryKey: ['insights-subscriber-engagement', from, to],
    queryFn: () => apiFetch(`/insights/subscriber-engagement?from=${from}&to=${to}`),
    staleTime: 10 * 60 * 1000,
  });
}
