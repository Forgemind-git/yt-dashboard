import { useTrafficSources, useGeography, useDevices, useDemographics } from '../hooks/useAudience';
import { SkeletonChart } from '../components/Skeleton';
import BarChartCard from '../components/BarChartCard';
import DonutChartCard from '../components/DonutChartCard';

export default function Audience() {
  const { data: traffic, isLoading: trafficLoading } = useTrafficSources();
  const { data: geo, isLoading: geoLoading } = useGeography();
  const { data: devices, isLoading: devLoading } = useDevices();
  const { data: demographics, isLoading: demoLoading } = useDemographics();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-200">Audience Insights</h2>
        <p className="text-xs text-gray-500 mt-0.5">Traffic, geography, devices and demographics</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Traffic Sources */}
        {trafficLoading ? <SkeletonChart /> : traffic?.length > 0 ? (
          <BarChartCard
            title="Traffic Sources"
            subtitle="Where your views come from"
            data={traffic.map((t) => ({
              name: formatSourceName(t.source_type),
              views: Number(t.views),
            }))}
            dataKeys={['views']}
            colors={['#3B82F6']}
            layout="vertical"
            height={Math.max(200, Math.min(traffic.length * 32, 400))}
          />
        ) : (
          <EmptyCard title="Traffic Sources" />
        )}

        {/* Geography */}
        {geoLoading ? <SkeletonChart /> : geo?.length > 0 ? (
          <div className="card p-5 animate-slide-up">
            <h3 className="text-sm font-semibold text-gray-200">Top Countries</h3>
            <p className="text-xs text-gray-500 mt-0.5 mb-5">Views by country</p>
            <div className="space-y-3">
              {geo.slice(0, 10).map((g, i) => {
                const maxViews = Number(geo[0]?.views || 1);
                const pct = (Number(g.views) / maxViews) * 100;
                return (
                  <div key={g.country_code} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 w-5 text-right tabular-nums">{i + 1}</span>
                    <span className="text-xs font-semibold text-gray-300 w-8">{g.country_code}</span>
                    <div className="flex-1 h-2 bg-surface-4 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-accent to-blue-400 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-400 w-16 text-right tabular-nums">
                      {Number(g.views).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyCard title="Geography" />
        )}

        {/* Devices */}
        {devLoading ? <SkeletonChart /> : devices?.devices?.length > 0 ? (
          <DonutChartCard
            title="Devices"
            subtitle="Viewer device breakdown"
            data={devices.devices.map((d) => ({
              name: d.device_type,
              value: Number(d.views),
            }))}
          />
        ) : (
          <EmptyCard title="Devices" />
        )}

        {/* Demographics */}
        {demoLoading ? <SkeletonChart /> : demographics?.length > 0 ? (
          <BarChartCard
            title="Demographics"
            subtitle="Age and gender distribution"
            data={formatDemographics(demographics)}
            dataKeys={['male', 'female']}
            colors={['#3B82F6', '#EC4899']}
            layout="horizontal"
          />
        ) : (
          <div className="card p-5 animate-slide-up">
            <h3 className="text-sm font-semibold text-gray-200">Demographics</h3>
            <p className="text-xs text-gray-500 mt-0.5 mb-5">Age and gender distribution</p>
            <div className="flex items-center justify-center h-[200px]">
              <p className="text-sm text-gray-600">Insufficient data for demographics</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyCard({ title }) {
  return (
    <div className="card p-5 animate-slide-up">
      <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
      <div className="flex items-center justify-center h-[200px]">
        <p className="text-sm text-gray-600">No data available</p>
      </div>
    </div>
  );
}

function formatSourceName(name) {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace('Yt ', 'YT ');
}

function formatDemographics(data) {
  const grouped = {};
  for (const row of data) {
    const age = row.age_group.replace('age', '');
    if (!grouped[age]) grouped[age] = { name: age };
    grouped[age][row.gender.toLowerCase()] = parseFloat(row.viewer_percentage);
  }
  return Object.values(grouped).sort((a, b) => a.name.localeCompare(b.name));
}
