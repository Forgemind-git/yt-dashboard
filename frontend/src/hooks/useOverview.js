import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { useDateRange } from '../context/DateRangeContext';

export function useOverview() {
  const { from, to } = useDateRange();
  return useQuery({
    queryKey: ['overview', from, to],
    queryFn: () => apiFetch(`/overview?from=${from}&to=${to}`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useChannelTimeseries() {
  const { from, to } = useDateRange();
  return useQuery({
    queryKey: ['channel-timeseries', from, to],
    queryFn: () => apiFetch(`/channel/timeseries?from=${from}&to=${to}`),
    staleTime: 5 * 60 * 1000,
  });
}
