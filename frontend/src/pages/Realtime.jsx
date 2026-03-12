import { useRealtime } from '../hooks/useRealtime';
import AreaChartCard from '../components/AreaChartCard';
import { SkeletonCard, SkeletonChart } from '../components/Skeleton';

export default function Realtime() {
  const { data, isLoading } = useRealtime();

  const latest = data?.latest;
  const history = data?.history || [];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <h2 className="text-lg font-semibold text-gray-200">Realtime</h2>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">Auto-refreshes every 2 minutes</p>
      </div>

      {/* Big numbers */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <SkeletonCard key={i} className="py-8" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <BigNumber
            label="Views (60 min)"
            value={latest?.views_last_60_min}
            color="text-accent"
          />
          <BigNumber
            label="Views (48 hours)"
            value={latest?.views_last_48_hours}
            color="text-gray-100"
          />
          <BigNumber
            label="Concurrent Viewers"
            value={latest?.concurrent_viewers}
            color="text-success"
          />
        </div>
      )}

      {/* History chart */}
      {isLoading ? (
        <SkeletonChart height="h-[350px]" />
      ) : history.length > 0 ? (
        <AreaChartCard
          title="48-Hour History"
          subtitle="Views collected every 30 minutes"
          data={history.map((h) => ({
            date: h.collected_at,
            'Last 60 min': h.views_last_60_min,
            'Last 48h': h.views_last_48_hours,
          }))}
          dataKeys={['Last 60 min', 'Last 48h']}
          colors={['#3B82F6', '#8B5CF6']}
          height={320}
        />
      ) : (
        <div className="card p-12 text-center">
          <p className="text-sm text-gray-500">No realtime history yet. Data collects every 30 minutes.</p>
        </div>
      )}

      {latest && (
        <p className="text-xs text-gray-600 text-center">
          Last updated: {new Date(latest.collected_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}

function BigNumber({ label, value, color }) {
  return (
    <div className="card p-6 text-center animate-slide-up">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-3">{label}</p>
      <p className={`text-4xl md:text-5xl font-bold tracking-tight ${color}`}>
        {value !== null && value !== undefined ? Number(value).toLocaleString() : '--'}
      </p>
    </div>
  );
}
