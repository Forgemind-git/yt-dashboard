import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#F97316'];

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-3 border border-border rounded-lg px-3 py-2 shadow-lg">
      <div className="flex items-center gap-2 text-sm">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].payload.fill }} />
        <span className="text-gray-400">{payload[0].name}:</span>
        <span className="font-semibold text-gray-100">{Number(payload[0].value).toLocaleString()}</span>
      </div>
    </div>
  );
}

export default function DonutChartCard({ title, subtitle, data, height = 280 }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="card p-5 animate-slide-up">
      <div className="mb-5">
        {title && <h3 className="text-sm font-semibold text-gray-200">{title}</h3>}
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-6">
        <div className="flex-1">
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={95}
                paddingAngle={3}
                dataKey="value"
                nameKey="name"
                stroke="none"
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Legend */}
        <div className="shrink-0 space-y-2 min-w-[140px]">
          {data.slice(0, 6).map((item, i) => {
            const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
            return (
              <div key={item.name} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-xs text-gray-400 flex-1 truncate">{item.name}</span>
                <span className="text-xs font-medium text-gray-300">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
