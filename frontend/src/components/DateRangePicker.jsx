import { useDateRange } from '../context/DateRangeContext';

const PRESETS = [
  { label: '7 days', value: '7d' },
  { label: '28 days', value: '28d' },
  { label: '90 days', value: '90d' },
  { label: '1 year', value: '365d' },
];

export default function DateRangePicker() {
  const { from, to, preset, setPreset, setCustomRange } = useDateRange();

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex bg-surface-2 rounded-lg p-0.5 border border-border">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPreset(p.value)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer
              ${preset === p.value
                ? 'bg-accent text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-300'
              }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5 ml-1.5">
        <input
          type="date"
          value={from}
          onChange={(e) => setCustomRange(e.target.value, to)}
          className="bg-surface-2 border border-border rounded-lg px-2.5 py-1.5 text-xs text-gray-400 focus:border-accent focus:ring-0 transition-colors"
          aria-label="Start date"
        />
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
        <input
          type="date"
          value={to}
          onChange={(e) => setCustomRange(from, e.target.value)}
          className="bg-surface-2 border border-border rounded-lg px-2.5 py-1.5 text-xs text-gray-400 focus:border-accent focus:ring-0 transition-colors"
          aria-label="End date"
        />
      </div>
    </div>
  );
}
