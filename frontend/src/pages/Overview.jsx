import KpiCard from '../components/KpiCard';
import AreaChartCard from '../components/AreaChartCard';
import { SkeletonCard, SkeletonChart } from '../components/Skeleton';
import { useOverview, useChannelTimeseries } from '../hooks/useOverview';
import { useRealtime } from '../hooks/useRealtime';

const KPIS = [
  { key: 'views', title: 'Views', format: 'number' },
  { key: 'watchTime', title: 'Watch Time', format: 'duration' },
  { key: 'subscribers', title: 'Subscribers', format: 'number' },
  { key: 'impressions', title: 'Impressions', format: 'number' },
  { key: 'ctr', title: 'CTR', format: 'percent' },
  { key: 'revenue', title: 'Revenue', format: 'currency' },
];

export default function Overview() {
  const { data: overview, isLoading } = useOverview();
  const { data: timeseries, isLoading: tsLoading } = useChannelTimeseries();
  const { data: realtime } = useRealtime();

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {isLoading
          ? [...Array(6)].map((_, i) => <SkeletonCard key={i} />)
          : KPIS.map((kpi) => (
              <KpiCard
                key={kpi.key}
                title={kpi.title}
                value={overview?.[kpi.key]?.value ?? 0}
                change={overview?.[kpi.key]?.change}
                format={kpi.format}
              />
            ))
        }
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {tsLoading ? (
          <>
            <SkeletonChart />
            <SkeletonChart />
          </>
        ) : timeseries?.length > 0 ? (
          <>
            <AreaChartCard
              title="Views"
              subtitle="Daily views over time"
              data={timeseries}
              dataKeys={['views']}
              colors={['#3B82F6']}
            />
            <AreaChartCard
              title="Subscribers"
              subtitle="Net subscriber change"
              data={timeseries}
              dataKeys={['subscribers']}
              colors={['#10B981']}
            />
          </>
        ) : (
          <div className="col-span-2 card p-12 text-center">
            <p className="text-gray-500 text-sm">No timeseries data yet. Trigger a collection from the System page.</p>
          </div>
        )}
      </div>

      {/* Realtime strip */}
      {realtime?.latest && (
        <div className="card p-5 animate-slide-up">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <h3 className="text-sm font-semibold text-gray-200">Realtime</h3>
          </div>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Last 60 min</p>
              <p className="text-3xl font-bold text-gray-100 tracking-tight">
                {Number(realtime.latest.views_last_60_min).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Last 48 hours</p>
              <p className="text-3xl font-bold text-gray-100 tracking-tight">
                {Number(realtime.latest.views_last_48_hours).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Updated</p>
              <p className="text-sm text-gray-400 mt-1">
                {new Date(realtime.latest.collected_at).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
