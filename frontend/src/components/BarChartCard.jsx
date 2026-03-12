import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const CHART_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];

function formatTick(v) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
  return v;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-3 border border-border rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-gray-400 mb-1.5">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-400 capitalize">{entry.dataKey}:</span>
          <span className="font-semibold text-gray-100">{Number(entry.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

export default function BarChartCard({ title, subtitle, data, dataKeys, colors, layout = 'vertical', height = 280 }) {
  const chartColors = colors || CHART_COLORS;
  const isHorizontal = layout === 'horizontal';

  return (
    <div className="card p-5 animate-slide-up">
      <div className="mb-5">
        {title && <h3 className="text-sm font-semibold text-gray-200">{title}</h3>}
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout={layout} margin={{ top: 0, right: 5, left: isHorizontal ? -10 : 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" horizontal={!isHorizontal} vertical={isHorizontal} />
          {isHorizontal ? (
            <>
              <XAxis dataKey="name" stroke="transparent" tick={{ fill: '#555', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis stroke="transparent" tick={{ fill: '#555', fontSize: 11 }} tickFormatter={formatTick} tickLine={false} axisLine={false} />
            </>
          ) : (
            <>
              <XAxis type="number" stroke="transparent" tick={{ fill: '#555', fontSize: 11 }} tickFormatter={formatTick} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" stroke="transparent" tick={{ fill: '#999', fontSize: 11 }} tickLine={false} axisLine={false} width={110} />
            </>
          )}
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          {dataKeys.length > 1 && (
            <Legend
              formatter={(value) => <span className="text-xs text-gray-400 capitalize">{value}</span>}
              iconType="circle"
              iconSize={8}
            />
          )}
          {dataKeys.map((key, i) => (
            <Bar
              key={key}
              dataKey={key}
              fill={chartColors[i % chartColors.length]}
              radius={isHorizontal ? [4, 4, 0, 0] : [0, 4, 4, 0]}
              maxBarSize={32}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
