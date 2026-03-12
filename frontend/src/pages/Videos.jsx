import { useState } from 'react';
import { useVideoList, useVideoDetail } from '../hooks/useVideos';
import { SkeletonRow } from '../components/Skeleton';
import AreaChartCard from '../components/AreaChartCard';

const SORT_OPTIONS = [
  { value: 'views', label: 'Views' },
  { value: 'watch_time', label: 'Watch time' },
  { value: 'likes', label: 'Likes' },
  { value: 'comments', label: 'Comments' },
];

export default function Videos() {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('views');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const { data, isLoading } = useVideoList(page, 20, sort);
  const { data: videoDetail } = useVideoDetail(selectedVideo);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-200">Content Performance</h2>
          <p className="text-xs text-gray-500 mt-0.5">{data?.total ?? 0} videos</p>
        </div>
        <div className="flex bg-surface-2 rounded-lg p-0.5 border border-border">
          {SORT_OPTIONS.map((s) => (
            <button
              key={s.value}
              onClick={() => { setSort(s.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer
                ${sort === s.value ? 'bg-accent text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Video detail chart */}
      {selectedVideo && videoDetail?.length > 0 && (
        <AreaChartCard
          title="Performance Over Time"
          data={videoDetail}
          dataKeys={['views', 'likes']}
          colors={['#3B82F6', '#8B5CF6']}
          height={200}
        />
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Video</th>
              <th className="text-right py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Views</th>
              <th className="text-right py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-gray-500 hidden md:table-cell">Watch Time</th>
              <th className="text-right py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-gray-500 hidden lg:table-cell">Likes</th>
              <th className="text-right py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-gray-500 hidden lg:table-cell">Comments</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}><td colSpan={5}><SkeletonRow /></td></tr>
              ))
            ) : data?.data?.length > 0 ? (
              data.data.map((v) => (
                <tr
                  key={v.video_id}
                  onClick={() => setSelectedVideo(selectedVideo === v.video_id ? null : v.video_id)}
                  className={`border-b border-border cursor-pointer transition-colors duration-150
                    ${selectedVideo === v.video_id
                      ? 'bg-accent/5'
                      : 'hover:bg-surface-3'
                    }`}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {v.thumbnail_url ? (
                        <img
                          src={v.thumbnail_url}
                          alt=""
                          className="w-20 h-[45px] rounded-md object-cover shrink-0 bg-surface-4"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-20 h-[45px] rounded-md bg-surface-4 shrink-0" />
                      )}
                      <span className="text-sm text-gray-300 line-clamp-2 leading-snug">{v.title || v.video_id}</span>
                    </div>
                  </td>
                  <td className="text-right py-3 px-4 font-medium text-gray-200 tabular-nums">
                    {Number(v.views).toLocaleString()}
                  </td>
                  <td className="text-right py-3 px-4 text-gray-400 tabular-nums hidden md:table-cell">
                    {Number(v.watch_time).toLocaleString()}m
                  </td>
                  <td className="text-right py-3 px-4 text-gray-400 tabular-nums hidden lg:table-cell">
                    {Number(v.likes).toLocaleString()}
                  </td>
                  <td className="text-right py-3 px-4 text-gray-400 tabular-nums hidden lg:table-cell">
                    {Number(v.comments).toLocaleString()}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-12 text-center text-gray-500 text-sm">
                  No video data yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data?.data?.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Page {page} of {Math.ceil((data?.total || 1) / 20)}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="btn-secondary text-xs disabled:opacity-30"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={!data?.data?.length || data.data.length < 20}
              className="btn-secondary text-xs disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
