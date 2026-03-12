export default function KpiCard({ title, value, change, format = 'number', icon }) {
  const formatValue = (v) => {
    if (v === undefined || v === null) return '--';
    if (format === 'percent') return `${(v * 100).toFixed(2)}%`;
    if (format === 'currency') return `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (format === 'duration') {
      const hours = Math.floor(v / 60);
      const mins = Math.round(v % 60);
      return hours > 0 ? `${hours.toLocaleString()}h ${mins}m` : `${mins}m`;
    }
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
    return Number(v).toLocaleString();
  };

  const isPositive = change > 0;
  const isNegative = change < 0;

  return (
    <div className="card p-4 group animate-slide-up">
      <div className="flex items-start justify-between mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{title}</p>
        {icon && <span className="text-gray-600">{icon}</span>}
      </div>
      <p className="text-2xl font-bold text-gray-100 tracking-tight">{formatValue(value)}</p>
      {change !== undefined && change !== null && (
        <div className="flex items-center gap-1 mt-2">
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold
            ${isPositive ? 'bg-success/10 text-success' : isNegative ? 'bg-danger/10 text-danger' : 'bg-surface-4 text-gray-500'}`}>
            {isPositive ? (
              <svg viewBox="0 0 12 12" className="w-3 h-3" fill="currentColor"><path d="M6 2.5l4 5H2l4-5z"/></svg>
            ) : isNegative ? (
              <svg viewBox="0 0 12 12" className="w-3 h-3" fill="currentColor"><path d="M6 9.5l-4-5h8l-4 5z"/></svg>
            ) : null}
            {Math.abs(change).toFixed(1)}%
          </span>
          <span className="text-[11px] text-gray-600">vs prev</span>
        </div>
      )}
    </div>
  );
}
