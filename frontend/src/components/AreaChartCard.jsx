import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const CHART_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];

function formatTick(v) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
  return v;
}

function formatDate(v) {
  const d = new Date(v);
  return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-3 border border-border rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-gray-400 mb-1.5">{formatDate(label)}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-400 capitalize">{entry.dataKey.replace(/_/g, ' ')}:</span>
          <span className="font-semibold text-gray-100">{Number(entry.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

/** Cap Y-axis at 95th percentile × 1.2 so outlier spikes don't crush the chart */
function computeYDomain(data, dataKeys) {
  const vals = data.flatMap(d => dataKeys.map(k => Number(d[k]) || 0)).sort((a, b) => a - b);
  if (!vals.length) return [0, 'auto'];
  const p95 = vals[Math.floor(vals.length * 0.95)] || vals[vals.length - 1];
  return [0, Math.ceil(p95 * 1.2)];
}

export default function AreaChartCard({ title, subtitle, data, dataKeys, colors, height = 280 }) {
  const chartColors = colors || CHART_COLORS;
  const yDomain = data?.length ? computeYDomain(data, dataKeys) : [0, 'auto'];

  return (
    <div className="card p-5 animate-slide-up">
      <div className="flex items-baseline justify-between mb-5">
        <div>
          {title && <h3 className="text-sm font-semibold text-gray-200">{title}</h3>}
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <defs>
            {dataKeys.map((key, i) => (
              <linearGradient key={key} id={`gradient-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColors[i % chartColors.length]} stopOpacity={0.2} />
                <stop offset="100%" stopColor={chartColors[i % chartColors.length]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="transparent"
            tick={{ fill: '#555', fontSize: 11 }}
            tickFormatter={formatDate}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="transparent"
            tick={{ fill: '#555', fontSize: 11 }}
            tickFormatter={formatTick}
            tickLine={false}
            axisLine={false}
            width={45}
            domain={yDomain}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#333', strokeDasharray: '3 3' }} />
          {dataKeys.map((key, i) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={chartColors[i % chartColors.length]}
              fill={`url(#gradient-${key})`}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: chartColors[i % chartColors.length], strokeWidth: 2, fill: '#000' }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
