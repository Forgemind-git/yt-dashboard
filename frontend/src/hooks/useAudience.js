import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { useDateRange } from '../context/DateRangeContext';

export function useTrafficSources() {
  const { from, to } = useDateRange();
  return useQuery({
    queryKey: ['traffic-sources', from, to],
    queryFn: () => apiFetch(`/traffic-sources?from=${from}&to=${to}`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useGeography() {
  const { from, to } = useDateRange();
  return useQuery({
    queryKey: ['geography', from, to],
    queryFn: () => apiFetch(`/geography?from=${from}&to=${to}`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDevices() {
  const { from, to } = useDateRange();
  return useQuery({
    queryKey: ['devices', from, to],
    queryFn: () => apiFetch(`/devices?from=${from}&to=${to}`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDemographics() {
  const { from, to } = useDateRange();
  return useQuery({
    queryKey: ['demographics', from, to],
    queryFn: () => apiFetch(`/demographics?from=${from}&to=${to}`),
    staleTime: 5 * 60 * 1000,
  });
}
