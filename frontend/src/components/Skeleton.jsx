export function SkeletonCard({ className = '' }) {
  return (
    <div className={`card p-4 ${className}`}>
      <div className="h-3 w-16 bg-surface-4 rounded animate-pulse mb-3" />
      <div className="h-7 w-24 bg-surface-4 rounded animate-pulse mb-2" />
      <div className="h-4 w-14 bg-surface-4 rounded animate-pulse" />
    </div>
  );
}

export function SkeletonChart({ className = '', height = 'h-[300px]' }) {
  return (
    <div className={`card p-5 ${className}`}>
      <div className="h-4 w-32 bg-surface-4 rounded animate-pulse mb-6" />
      <div className={`${height} bg-surface-3 rounded-lg animate-pulse`} />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-border">
      <div className="w-24 h-14 bg-surface-4 rounded animate-pulse shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 bg-surface-4 rounded animate-pulse" />
        <div className="h-3 w-1/2 bg-surface-4 rounded animate-pulse" />
      </div>
    </div>
  );
}
