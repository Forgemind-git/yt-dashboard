import { useCollectionLogs, useTriggerCollection } from '../hooks/useHealth';
import { SkeletonRow } from '../components/Skeleton';

const STATUS_CONFIG = {
  success: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20', dot: 'bg-success' },
  error: { bg: 'bg-danger/10', text: 'text-danger', border: 'border-danger/20', dot: 'bg-danger' },
  running: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20', dot: 'bg-warning' },
};

export default function Health() {
  const { data: logs, isLoading } = useCollectionLogs();
  const triggerMutation = useTriggerCollection();

  // Group logs by run_id
  const runs = {};
  for (const log of logs || []) {
    if (!runs[log.run_id]) runs[log.run_id] = [];
    runs[log.run_id].push(log);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-200">System Health</h2>
          <p className="text-xs text-gray-500 mt-0.5">Collection runs and status</p>
        </div>
        <button
          onClick={() => triggerMutation.mutate()}
          disabled={triggerMutation.isPending}
          className="btn-primary"
        >
          {triggerMutation.isPending ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
              </svg>
              Running...
            </span>
          ) : 'Trigger Collection'}
        </button>
      </div>

      {triggerMutation.isSuccess && (
        <div className="bg-success/5 border border-success/20 rounded-xl px-4 py-3 text-sm text-success animate-slide-up">
          Collection triggered successfully.
        </div>
      )}

      {/* Logs table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Run</th>
              <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Collector</th>
              <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Status</th>
              <th className="text-right py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Rows</th>
              <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-gray-500 hidden lg:table-cell">Error</th>
              <th className="text-right py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Duration</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}><td colSpan={6}><SkeletonRow /></td></tr>
              ))
            ) : (logs || []).length > 0 ? (
              (logs || []).map((log) => {
                const style = STATUS_CONFIG[log.status] || STATUS_CONFIG.running;
                const duration = log.finished_at && log.started_at
                  ? `${((new Date(log.finished_at) - new Date(log.started_at)) / 1000).toFixed(1)}s`
                  : '--';
                return (
                  <tr
                    key={`${log.run_id}-${log.collector_name}`}
                    className="border-b border-border hover:bg-surface-3 transition-colors duration-150"
                  >
                    <td className="py-3 px-4">
                      <code className="text-xs text-gray-500 font-mono">{log.run_id.slice(0, 8)}</code>
                    </td>
                    <td className="py-3 px-4 text-gray-300">{log.collector_name}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${style.bg} ${style.text} border ${style.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                        {log.status}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4 text-gray-400 tabular-nums">{log.rows_affected ?? '--'}</td>
                    <td className="py-3 px-4 text-danger text-xs max-w-[200px] truncate hidden lg:table-cell">
                      {log.error_message || ''}
                    </td>
                    <td className="text-right py-3 px-4 text-gray-500 text-xs tabular-nums">{duration}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <p className="text-sm text-gray-500">No collection logs yet</p>
                  <p className="text-xs text-gray-600 mt-1">Click "Trigger Collection" to start</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
