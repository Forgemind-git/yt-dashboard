import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { useDateRange } from '../context/DateRangeContext';

export function useVideoList(page = 1, limit = 20, sort = 'views') {
  const { from, to } = useDateRange();
  return useQuery({
    queryKey: ['video-list', from, to, page, limit, sort],
    queryFn: () => apiFetch(`/videos/list?from=${from}&to=${to}&page=${page}&limit=${limit}&sort=${sort}`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useVideoDetail(videoId) {
  const { from, to } = useDateRange();
  return useQuery({
    queryKey: ['video-detail', videoId, from, to],
    queryFn: () => apiFetch(`/videos/${videoId}?from=${from}&to=${to}`),
    enabled: !!videoId,
    staleTime: 5 * 60 * 1000,
  });
}
