import { useState, useEffect, useRef } from 'react';
import {
  useGrowthInsights,
  useContentScore,
  useUploadTiming,
  useOutliers,
  useInsightsSummary,
  useRetention,
  useTrafficROI,
  useChannelHealth,
  useRecommendations,
  useLifecycle,
  useContentPatterns,
  useUploadGaps,
  useSubscriberQuality,
  useGrowthBenchmark,
  useSubscriberEngagement,
} from '../hooks/useInsights';
import { SkeletonCard, SkeletonChart } from '../components/Skeleton';
import AreaChartCard from '../components/AreaChartCard';
import BarChartCard from '../components/BarChartCard';

/** Fires once when the referenced element scrolls into the viewport */
function useLazyVisible(ref) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        obs.disconnect();
      }
    });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [ref]);
  return visible;
}

/* ─── Formatting helpers ─── */

function formatNumber(n) {
  if (n == null) return '--';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return Number(n).toLocaleString();
}

function formatMilestone(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(0)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return Number(n).toLocaleString();
}

function formatPercent(n) {
  if (n == null) return '--';
  return `${Number(n).toFixed(1)}%`;
}

function formatDuration(mins) {
  if (mins == null) return '--';
  if (mins >= 60) return `${(mins / 60).toFixed(1)}h`;
  return `${Number(mins).toFixed(0)}m`;
}

/* ─── Constants ─── */

const GRADE_COLORS = {
  S: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  A: 'bg-success/10 text-success border-success/20',
  B: 'bg-accent/10 text-accent border-accent/20',
  C: 'bg-warning/10 text-warning border-warning/20',
  D: 'bg-danger/10 text-danger border-danger/20',
};

const PRIORITY_COLORS = {
  HIGH: 'bg-danger/15 text-danger border-danger/20',
  MEDIUM: 'bg-warning/15 text-warning border-warning/20',
  LOW: 'bg-accent/15 text-accent border-accent/20',
};

const INSIGHT_ICONS = {
  positive: { color: 'text-success', bg: 'bg-success/10' },
  warning: { color: 'text-warning', bg: 'bg-warning/10' },
  neutral: { color: 'text-gray-400', bg: 'bg-surface-4' },
  info: { color: 'text-accent', bg: 'bg-accent/10' },
  negative: { color: 'text-danger', bg: 'bg-danger/10' },
  milestone: { color: 'text-purple-400', bg: 'bg-purple-500/10' },
};

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ─── SVG Gauge component ─── */

function HealthGauge({ score, size = 180, strokeWidth = 14 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(score || 0, 0), 100) / 100;
  const dashOffset = circumference * (1 - progress);

  let color = '#EF4444'; // danger
  if (score >= 70) color = '#10B981'; // success
  else if (score >= 40) color = '#F59E0B'; // warning

  let label = 'Critical';
  if (score >= 80) label = 'Excellent';
  else if (score >= 70) label = 'Good';
  else if (score >= 50) label = 'Fair';
  else if (score >= 40) label = 'Needs Work';

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#222222"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-4xl font-bold text-gray-100">{Math.round(score || 0)}</span>
        <span className="text-xs text-gray-500 mt-0.5">{label}</span>
      </div>
    </div>
  );
}

function MiniGauge({ score, size = 56, strokeWidth = 5 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(score || 0, 0), 100) / 100;
  const dashOffset = circumference * (1 - progress);

  let color = '#EF4444';
  if (score >= 70) color = '#10B981';
  else if (score >= 40) color = '#F59E0B';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#222222" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      <span className="absolute text-xs font-bold text-gray-200">{Math.round(score || 0)}</span>
    </div>
  );
}

/* ─── Insight Icon ─── */

function InsightIcon({ type }) {
  if (type === 'positive' || type === 'milestone') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
      </svg>
    );
  }
  if (type === 'warning' || type === 'negative') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
    </svg>
  );
}

/* ─── Trajectory Arrow ─── */

function TrajectoryArrow({ trajectory }) {
  if (trajectory === 'up') return <span className="text-success text-sm">&#9650;</span>;
  if (trajectory === 'down') return <span className="text-danger text-sm">&#9660;</span>;
  return <span className="text-gray-500 text-sm">&#9654;</span>;
}

/* ─── Section component ─── */

function Section({ title, subtitle, children }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/* ─── Empty State ─── */

function EmptyState({ message = 'Not enough data yet' }) {
  return (
    <div className="card p-8 animate-slide-up text-center">
      <p className="text-sm text-gray-600">{message}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function Insights() {
  // Immediately load the first visible sections (max ~4 concurrent queries)
  const { data: health, isLoading: healthLoading } = useChannelHealth();
  const { data: benchmark, isLoading: benchmarkLoading } = useGrowthBenchmark();
  const { data: recs, isLoading: recsLoading } = useRecommendations();
  const { data: summary, isLoading: summaryLoading } = useInsightsSummary();

  // Lazy-load section 2: fires when the user scrolls past the initial view
  const lazyRef1 = useRef(null);
  const lazy1 = useLazyVisible(lazyRef1);
  const { data: growth, isLoading: growthLoading } = useGrowthInsights({ enabled: lazy1 });
  const { data: content, isLoading: contentLoading } = useContentScore({ enabled: lazy1 });
  const { data: timing, isLoading: timingLoading } = useUploadTiming({ enabled: lazy1 });
  const { data: retention, isLoading: retentionLoading } = useRetention({ enabled: lazy1 });
  const { data: trafficROI, isLoading: trafficLoading } = useTrafficROI({ enabled: lazy1 });

  // Lazy-load section 3: fires when user scrolls further down
  const lazyRef2 = useRef(null);
  const lazy2 = useLazyVisible(lazyRef2);
  const { data: outliers, isLoading: outliersLoading } = useOutliers({ enabled: lazy2 });
  const { data: lifecycle, isLoading: lifecycleLoading } = useLifecycle({ enabled: lazy2 });
  const { data: contentPatterns, isLoading: contentPatternsLoading } = useContentPatterns({ enabled: lazy2 });
  const { data: uploadGaps, isLoading: uploadGapsLoading } = useUploadGaps({ enabled: lazy2 });
  const { data: subQuality, isLoading: subQualityLoading } = useSubscriberQuality({ enabled: lazy2 });
  const { data: subEngagement, isLoading: subEngagementLoading } = useSubscriberEngagement({ enabled: lazy2 });

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-200">Insights</h2>
        <p className="text-xs text-gray-500 mt-0.5">Analytics you won't find in YouTube Studio</p>
      </div>

      {/* ─── Section 1: Channel Health Score ─── */}
      {healthLoading ? (
        <SkeletonChart height="h-[320px]" />
      ) : health ? (
        <div className="card p-6 animate-slide-up">
          <h3 className="text-sm font-semibold text-gray-200 mb-1">Channel Health</h3>
          <p className="text-xs text-gray-500 mb-6">Composite score based on 6 key factors</p>

          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* Gauge */}
            <div className="relative flex-shrink-0">
              <HealthGauge score={health.score} />
            </div>

            {/* Factor bars */}
            <div className="flex-1 w-full space-y-3">
              {(health.factors || []).map((factor) => {
                const s = factor.score ?? 0;
                let barColor = 'bg-danger';
                if (s >= 70) barColor = 'bg-success';
                else if (s >= 40) barColor = 'bg-warning';

                return (
                  <div key={factor.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-300 font-medium">{factor.name}</span>
                      <span className="text-xs text-gray-500 tabular-nums">{Math.round(s)}/100</span>
                    </div>
                    <div className="h-1.5 bg-surface-4 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                        style={{ width: `${Math.min(s, 100)}%` }}
                      />
                    </div>
                    {factor.explanation && (
                      <p className="text-[10px] text-gray-600 mt-0.5">{factor.explanation}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <EmptyState message="Channel health data not available yet" />
      )}

      {/* ─── Growth Benchmarks ─── */}
      {benchmarkLoading ? (
        <SkeletonChart />
      ) : benchmark?.periods?.length > 0 ? (
        <Section title="Growth Benchmarks" subtitle={benchmark.acceleration?.message || 'Comparing 30-day performance windows'}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {benchmark.periods.map((p, i) => (
              <div key={p.label} className="card p-4 animate-slide-up text-center">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">{p.label}</p>
                <p className="text-lg font-bold text-gray-100">{formatNumber(p.totalViews)}</p>
                <p className="text-[11px] text-gray-500">views</p>
                <p className="text-sm font-semibold text-gray-300 mt-1">{formatNumber(p.totalSubs)}</p>
                <p className="text-[11px] text-gray-500">subs</p>
                {p.viewsChange != null && (
                  <p className={`text-xs font-medium mt-2 ${p.viewsChange > 0 ? 'text-success' : p.viewsChange < 0 ? 'text-danger' : 'text-gray-500'}`}>
                    {p.viewsChange > 0 ? '+' : ''}{p.viewsChange}% vs prev
                  </p>
                )}
              </div>
            ))}
          </div>

          {benchmark.monthlyTrend?.length > 0 && (
            <AreaChartCard
              title="Weekly Trend"
              subtitle="Views and subs aggregated by week"
              data={benchmark.monthlyTrend}
              dataKeys={['views', 'subs']}
              colors={['#3B82F6', '#10B981']}
              height={200}
            />
          )}

          {benchmark.acceleration && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
              benchmark.acceleration.direction === 'accelerating' ? 'bg-success/10 text-success' :
              benchmark.acceleration.direction === 'decelerating' ? 'bg-warning/10 text-warning' :
              'bg-surface-3 text-gray-400'
            }`}>
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                {benchmark.acceleration.direction === 'accelerating' ? (
                  <path fillRule="evenodd" d="M12.577 4.878a.75.75 0 01.919-.53l4.78 1.281a.75.75 0 01.531.919l-1.281 4.78a.75.75 0 01-1.449-.387l.81-3.022a19.407 19.407 0 00-5.594 5.203.75.75 0 01-1.139.093L7 10.06l-4.72 4.72a.75.75 0 01-1.06-1.061l5.25-5.25a.75.75 0 011.06 0l3.074 3.073a20.923 20.923 0 015.545-4.931l-3.042.815a.75.75 0 01-.53-.919z" clipRule="evenodd" />
                ) : (
                  <path fillRule="evenodd" d="M1.22 5.222a.75.75 0 011.06 0L7 9.942l3.768-3.769a.75.75 0 011.113.058 20.908 20.908 0 013.813 7.254l1.574-2.727a.75.75 0 011.3.75l-2.5 4.33a.75.75 0 01-1.025.275l-4.33-2.5a.75.75 0 01.75-1.3l2.776 1.603a19.406 19.406 0 00-3.501-6.238L7.53 11.533a.75.75 0 01-1.06 0l-5.25-5.25a.75.75 0 010-1.06z" clipRule="evenodd" />
                )}
              </svg>
              <span className="text-sm">{benchmark.acceleration.message}</span>
            </div>
          )}
        </Section>
      ) : null}

      {/* ─── Section 2: Recommendations ─── */}
      {recsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : recs?.recommendations?.length > 0 ? (
        <Section title="Recommendations" subtitle="Actionable steps to improve your channel">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recs.recommendations.slice(0, 5).map((rec, i) => {
              const pStyle = PRIORITY_COLORS[rec.priority] || PRIORITY_COLORS.LOW;
              return (
                <div key={i} className="card p-4 animate-slide-up flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${pStyle}`}>
                      {rec.priority}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-gray-200 leading-snug">{rec.title}</h4>
                  <p className="text-xs text-gray-400 flex-1">{rec.description}</p>
                  {rec.dataPoint && (
                    <div className="bg-surface-3 rounded-lg px-3 py-2 mt-auto">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider">Data point</span>
                      <p className="text-xs text-gray-300 font-medium mt-0.5">{rec.dataPoint}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      ) : null}

      {/* ─── Section 3: Auto-Generated Summary ─── */}
      {summaryLoading ? (
        <SkeletonCard />
      ) : summary?.insights?.length > 0 ? (
        <div className="card p-5 animate-slide-up">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">Channel Summary</h3>
          {renderGroupedInsights(summary.insights)}
        </div>
      ) : null}

      {/* Lazy trigger: queries below here fire when user scrolls into view */}
      <div ref={lazyRef1} />

      {/* ─── Section 4: Growth Momentum ─── */}
      {growthLoading ? (
        <SkeletonChart />
      ) : growth ? (
        <div className="space-y-4">
          <Section title="Growth Momentum" subtitle="Velocity and trajectory of channel growth">
            {/* Momentum + Week-over-week */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Momentum gauge */}
              {growth.momentum != null && (
                <div className="card p-4 animate-slide-up flex flex-col items-center justify-center">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Momentum</p>
                  <MiniGauge score={growth.momentum} />
                  {growth.momentumLabel && (
                    <p className="text-[10px] text-gray-500 mt-2">{growth.momentumLabel}</p>
                  )}
                </div>
              )}

              {/* Week-over-week cards — backend returns {thisWeek, lastWeek, twoWeeksAgo} object */}
              {growth.weekOverWeek && [
                { label: 'This Week', data: growth.weekOverWeek.thisWeek },
                { label: 'Last Week', data: growth.weekOverWeek.lastWeek },
                { label: '2 Weeks Ago', data: growth.weekOverWeek.twoWeeksAgo },
              ].filter(w => w.data).map((w, i) => (
                <div key={i} className="card p-4 animate-slide-up text-center">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">{w.label}</p>
                  <p className="text-lg font-bold text-gray-100">{formatNumber(w.data.views)}</p>
                  <p className="text-[11px] text-gray-500">views</p>
                  <p className="text-sm font-semibold text-gray-300 mt-1">{formatNumber(w.data.subs)}</p>
                  <p className="text-[11px] text-gray-500">subs</p>
                </div>
              ))}
            </div>

            {/* Growth velocity chart */}
            {growth.velocityChart?.length > 0 && (
              <AreaChartCard
                title="Growth Velocity"
                subtitle="Daily subscribers and views (90 days)"
                data={growth.velocityChart}
                dataKeys={['subs', 'views']}
                colors={['#10B981', '#3B82F6']}
                height={240}
              />
            )}

            {/* Growth rate boxes */}
            {growth.growthRates && (
              <div className="grid grid-cols-3 gap-4">
                {['7d', '28d', '90d'].map((period) => (
                  <div key={period} className="card p-4 animate-slide-up text-center">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{period} avg</p>
                    <p className="text-lg font-bold text-gray-100">
                      {growth.growthRates[period]?.subs?.toFixed(1) || '0'}{' '}
                      <span className="text-xs text-gray-500 font-normal">subs/day</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {Math.round(growth.growthRates[period]?.views || 0).toLocaleString()} views/day
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Best / worst days */}
            {(growth.bestDays?.length > 0 || growth.worstDays?.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {growth.bestDays?.length > 0 && (
                  <div className="card p-4 animate-slide-up">
                    <p className="text-[10px] uppercase tracking-wider text-success font-semibold mb-2">Best Days</p>
                    <div className="space-y-1.5">
                      {growth.bestDays.slice(0, 5).map((d, i) => (
                        <div key={i} className="flex items-center justify-between text-xs py-1">
                          <span className="text-gray-400">{d.date}</span>
                          <span className="text-gray-300 font-medium">{formatNumber(d.views)} views</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {growth.worstDays?.length > 0 && (
                  <div className="card p-4 animate-slide-up">
                    <p className="text-[10px] uppercase tracking-wider text-danger font-semibold mb-2">Lowest Days</p>
                    <div className="space-y-1.5">
                      {growth.worstDays.slice(0, 5).map((d, i) => (
                        <div key={i} className="flex items-center justify-between text-xs py-1">
                          <span className="text-gray-400">{d.date}</span>
                          <span className="text-gray-300 font-medium">{formatNumber(d.views)} views</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Trends */}
            {growth.trends?.length > 0 && (
              <div className="space-y-2">
                {growth.trends.map((trend, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                      trend.severity === 'positive' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                    }`}
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                      {trend.signal === 'accelerating' ? (
                        <path fillRule="evenodd" d="M12.577 4.878a.75.75 0 01.919-.53l4.78 1.281a.75.75 0 01.531.919l-1.281 4.78a.75.75 0 01-1.449-.387l.81-3.022a19.407 19.407 0 00-5.594 5.203.75.75 0 01-1.139.093L7 10.06l-4.72 4.72a.75.75 0 01-1.06-1.061l5.25-5.25a.75.75 0 011.06 0l3.074 3.073a20.923 20.923 0 015.545-4.931l-3.042.815a.75.75 0 01-.53-.919z" clipRule="evenodd" />
                      ) : (
                        <path fillRule="evenodd" d="M1.22 5.222a.75.75 0 011.06 0L7 9.942l3.768-3.769a.75.75 0 011.113.058 20.908 20.908 0 013.813 7.254l1.574-2.727a.75.75 0 011.3.75l-2.5 4.33a.75.75 0 01-1.025.275l-4.33-2.5a.75.75 0 01.75-1.3l2.776 1.603a19.406 19.406 0 00-3.501-6.238L7.53 11.533a.75.75 0 01-1.06 0l-5.25-5.25a.75.75 0 010-1.06z" clipRule="evenodd" />
                      )}
                    </svg>
                    <span className="text-sm">{trend.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Milestone projections */}
            {growth.projections?.length > 0 && (
              <div className="card p-5 animate-slide-up">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Milestone Projections</p>
                <div className="space-y-2">
                  {growth.projections.map((proj, i) => (
                    <div key={i} className="flex items-center justify-between py-2 px-3 bg-surface-3 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded ${
                            proj.type === 'subscribers' ? 'bg-success/10 text-success' : 'bg-accent/10 text-accent'
                          }`}
                        >
                          {proj.type === 'subscribers' ? 'SUBS' : 'VIEWS'}
                        </span>
                        <span className="text-sm text-gray-300 font-medium">{formatMilestone(proj.milestone)}</span>
                      </div>
                      <div className="text-right">
                        {proj.daysToReach ? (
                          <>
                            <p className="text-sm font-semibold text-gray-200">
                              {proj.daysToReach < 365 ? `${proj.daysToReach} days` : `${(proj.daysToReach / 365).toFixed(1)} years`}
                            </p>
                            <p className="text-xs text-gray-500">{proj.projectedDate}</p>
                          </>
                        ) : (
                          <p className="text-xs text-gray-600">Insufficient data</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>
        </div>
      ) : (
        <EmptyState message="Growth data not available yet" />
      )}

      {/* ─── Subscriber Quality ─── */}
      {subQualityLoading ? (
        <SkeletonChart />
      ) : subQuality?.qualityScore != null ? (
        <Section title="Subscriber Quality" subtitle="Retention and churn analysis (last 90 days)">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-4 animate-slide-up flex flex-col items-center justify-center">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Quality Score</p>
              <MiniGauge score={subQuality.qualityScore} />
              <p className="text-[10px] text-gray-500 mt-2">
                {subQuality.qualityScore >= 90 ? 'Excellent retention' : subQuality.qualityScore >= 70 ? 'Good retention' : subQuality.qualityScore >= 50 ? 'Average retention' : 'High churn'}
              </p>
            </div>
            <div className="card p-4 animate-slide-up text-center">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Avg Daily Gained</p>
              <p className="text-lg font-bold text-success">{subQuality.avgDailyGained}</p>
            </div>
            <div className="card p-4 animate-slide-up text-center">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Avg Daily Lost</p>
              <p className="text-lg font-bold text-danger">{subQuality.avgDailyLost}</p>
            </div>
            <div className="card p-4 animate-slide-up text-center">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Avg Churn Rate</p>
              <p className="text-lg font-bold text-gray-100">{subQuality.avgChurnRate}%</p>
            </div>
          </div>

          {subQuality.trend?.length > 0 && (
            <AreaChartCard
              title="Subscribers Gained vs Lost"
              subtitle="Daily subscriber movement (90 days)"
              data={subQuality.trend}
              dataKeys={['gained', 'lost']}
              colors={['#10B981', '#EF4444']}
              height={200}
            />
          )}

          {subQuality.churnSpikes?.length > 0 && (
            <div className="card p-5 animate-slide-up">
              <p className="text-[10px] uppercase tracking-wider text-danger font-semibold mb-3">Churn Spikes (Anomalous Loss)</p>
              <div className="space-y-1.5">
                {subQuality.churnSpikes.slice(0, 5).map((spike, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1.5 px-2 bg-surface-3 rounded">
                    <span className="text-gray-400">{spike.date}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-danger font-medium">-{spike.lost} lost</span>
                      <span className="text-gray-500">+{spike.gained} gained</span>
                      <span className="text-[10px] text-gray-600">z={spike.zScore}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {subQuality.weeklyCohorts?.length > 0 && (
            <div className="card p-5 animate-slide-up">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-3">Weekly Cohorts</p>
              <div className="space-y-1.5">
                {subQuality.weeklyCohorts.map((w, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1.5 px-2 bg-surface-3 rounded">
                    <span className="text-gray-400">{w.weekStart}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-success">+{w.gained}</span>
                      <span className="text-danger">-{w.lost}</span>
                      <span className="text-gray-300 font-medium">Net: {w.net > 0 ? '+' : ''}{w.net}</span>
                      <span className={`font-medium ${w.retentionRate >= 80 ? 'text-success' : w.retentionRate >= 60 ? 'text-warning' : 'text-danger'}`}>
                        {w.retentionRate}% ret
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>
      ) : null}

      {/* ─── Section 5: Content Performance ─── */}
      {contentLoading ? (
        <SkeletonChart />
      ) : content?.videos?.length > 0 ? (
        <Section title="Content Performance" subtitle="Score = weighted performance vs channel average (100 = average)">
          {/* Engagement funnel */}
          {content.funnel && (
            <div className="card p-5 animate-slide-up">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-3">Engagement Funnel</p>
              <div className="flex items-center gap-1">
                {[
                  { label: 'Views', value: content.funnel.views },
                  { label: 'Likes', value: content.funnel.likes },
                  { label: 'Comments', value: content.funnel.comments },
                  { label: 'Shares', value: content.funnel.shares },
                ].map((step, i, arr) => {
                  const maxVal = arr[0].value || 1;
                  const widthPct = Math.max(((step.value || 0) / maxVal) * 100, 8);
                  return (
                    <div key={step.label} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-lg bg-accent/20 flex items-center justify-center transition-all duration-500"
                        style={{ height: `${Math.max(widthPct * 0.6, 20)}px` }}
                      >
                        <span className="text-[10px] text-accent font-bold">{formatNumber(step.value)}</span>
                      </div>
                      <span className="text-[10px] text-gray-500">{step.label}</span>
                      {i < arr.length - 1 && step.value > 0 && (
                        <span className="text-[9px] text-gray-600">
                          {((arr[i + 1]?.value || 0) / step.value * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Content table */}
          <div className="card p-5 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-gray-500">
                Channel avg: {content.channelAvg?.views?.toLocaleString() || '--'} views
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Video</th>
                    <th className="text-center py-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Grade</th>
                    <th className="text-right py-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Score</th>
                    <th className="text-right py-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Views</th>
                    <th className="text-right py-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 hidden md:table-cell">Engage %</th>
                    <th className="text-right py-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 hidden md:table-cell">Retention</th>
                    <th className="text-right py-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 hidden lg:table-cell">Age</th>
                    <th className="text-center py-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 hidden lg:table-cell">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {content.videos.slice(0, 15).map((v) => (
                    <tr key={v.video_id} className="border-b border-border hover:bg-surface-3 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5">
                          {v.thumbnail_url && (
                            <img src={v.thumbnail_url} alt="" className="w-14 h-8 rounded object-cover shrink-0" loading="lazy" />
                          )}
                          <span className="text-xs text-gray-300 line-clamp-1">{v.title || v.video_id}</span>
                        </div>
                      </td>
                      <td className="text-center py-2.5 px-3">
                        <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded border ${GRADE_COLORS[v.grade] || GRADE_COLORS.C}`}>
                          {v.grade}
                        </span>
                      </td>
                      <td className="text-right py-2.5 px-3 font-semibold text-gray-200 tabular-nums">{v.score}</td>
                      <td className="text-right py-2.5 px-3 text-gray-400 tabular-nums">{formatNumber(v.views)}</td>
                      <td className="text-right py-2.5 px-3 text-gray-400 tabular-nums hidden md:table-cell">{v.engagementRate != null ? `${v.engagementRate}%` : '--'}</td>
                      <td className="text-right py-2.5 px-3 text-gray-400 tabular-nums hidden md:table-cell">{v.retentionScore != null ? v.retentionScore : '--'}</td>
                      <td className="text-right py-2.5 px-3 text-gray-500 tabular-nums hidden lg:table-cell">{v.ageDays != null ? `${v.ageDays}d` : '--'}</td>
                      <td className="text-center py-2.5 px-3 hidden lg:table-cell">
                        <TrajectoryArrow trajectory={v.trajectory} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>
      ) : (
        <EmptyState message="Content score data not available" />
      )}

      {/* ─── Lifecycle Curves ─── */}
      {lifecycleLoading ? (
        <SkeletonChart />
      ) : lifecycle?.videos?.length > 0 ? (
        <Section title="Video Lifecycle Curves" subtitle={`Channel profile: ${(lifecycle.channelProfile?.dominantType || 'unknown').replace(/_/g, ' ')} — ${lifecycle.channelProfile?.totalAnalyzed || 0} videos analyzed`}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lifecycle.videos.slice(0, 9).map((v) => {
              const typeColors = {
                viral_spike: 'bg-danger/15 text-danger border-danger/20',
                evergreen: 'bg-success/15 text-success border-success/20',
                slow_burn: 'bg-warning/15 text-warning border-warning/20',
                steady_grower: 'bg-accent/15 text-accent border-accent/20',
              };
              const badgeClass = typeColors[v.lifecycleType] || typeColors.steady_grower;

              return (
                <div key={v.videoId} className="card p-4 animate-slide-up">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <p className="text-xs text-gray-300 font-medium line-clamp-2 flex-1">{v.title}</p>
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border shrink-0 ${badgeClass}`}>
                      {v.lifecycleType.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 mb-2">{formatNumber(v.totalViews)} views / {v.ageDays}d old</p>
                  {/* Stage progress bars */}
                  <div className="space-y-1">
                    {Object.entries(v.stageShares || {}).map(([stage, pct]) => (
                      <div key={stage} className="flex items-center gap-2">
                        <span className="text-[9px] text-gray-500 w-16 shrink-0 capitalize">{stage}</span>
                        <div className="flex-1 h-1.5 bg-surface-4 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-accent/60 transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <span className="text-[9px] text-gray-600 w-10 text-right tabular-nums">{pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Channel profile summary */}
          {lifecycle.channelProfile?.typeCounts && (
            <div className="card p-5 animate-slide-up">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-3">Lifecycle Distribution</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(lifecycle.channelProfile.typeCounts).map(([type, count]) => (
                  <div key={type} className="bg-surface-3 rounded-lg p-3 text-center">
                    <p className="text-sm font-bold text-gray-200">{count}</p>
                    <p className="text-[10px] text-gray-500 capitalize">{type.replace(/_/g, ' ')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>
      ) : null}

      {/* ─── Content Patterns ─── */}
      {contentPatternsLoading ? (
        <SkeletonChart />
      ) : contentPatterns?.totalVideos > 0 ? (
        <Section title="Content Patterns" subtitle={`Pattern analysis across ${contentPatterns.totalVideos} videos`}>
          {/* Format comparison */}
          {contentPatterns.formats?.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contentPatterns.formats.map((f) => (
                <div key={f.format} className="card p-4 animate-slide-up">
                  <p className="text-xs font-semibold text-gray-300 mb-1">{f.format}</p>
                  <p className="text-lg font-bold text-gray-100">{formatNumber(f.avgViews)} <span className="text-xs font-normal text-gray-500">avg views</span></p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-gray-500">{f.count} videos</span>
                    <span className={`text-xs font-medium ${f.performanceVsAvg > 0 ? 'text-success' : f.performanceVsAvg < 0 ? 'text-danger' : 'text-gray-500'}`}>
                      {f.performanceVsAvg > 0 ? '+' : ''}{f.performanceVsAvg}% vs avg
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Language comparison */}
          {contentPatterns.languages?.length > 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contentPatterns.languages.map((l) => (
                <div key={l.language} className="card p-4 animate-slide-up">
                  <p className="text-xs font-semibold text-gray-300 mb-1">{l.language} Content</p>
                  <p className="text-lg font-bold text-gray-100">{formatNumber(l.avgViews)} <span className="text-xs font-normal text-gray-500">avg views</span></p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-gray-500">{l.count} videos</span>
                    <span className={`text-xs font-medium ${l.performanceVsAvg > 0 ? 'text-success' : l.performanceVsAvg < 0 ? 'text-danger' : 'text-gray-500'}`}>
                      {l.performanceVsAvg > 0 ? '+' : ''}{l.performanceVsAvg}% vs avg
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Keyword table */}
          {contentPatterns.keywords?.length > 0 && (
            <div className="card p-5 animate-slide-up">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-3">Top Keywords by Performance</p>
              <div className="space-y-1.5">
                {contentPatterns.keywords.slice(0, 10).map((k) => {
                  const maxPerf = Math.max(...contentPatterns.keywords.map(kw => Math.abs(kw.performanceVsAvg)), 1);
                  return (
                    <div key={k.keyword} className="flex items-center gap-2">
                      <span className="text-xs text-gray-300 w-24 shrink-0 font-mono truncate">{k.keyword}</span>
                      <div className="flex-1 h-2 bg-surface-4 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${k.performanceVsAvg > 0 ? 'bg-success/70' : 'bg-danger/50'}`}
                          style={{ width: `${Math.min(Math.abs(k.performanceVsAvg) / maxPerf * 100, 100)}%` }}
                        />
                      </div>
                      <span className={`text-xs w-16 text-right tabular-nums font-medium ${k.performanceVsAvg > 0 ? 'text-success' : 'text-danger'}`}>
                        {k.performanceVsAvg > 0 ? '+' : ''}{k.performanceVsAvg}%
                      </span>
                      <span className="text-[10px] text-gray-600 w-6 text-right">{k.videoCount}v</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Title length performance */}
          {contentPatterns.titleLengths?.length > 0 && (
            <div className="card p-5 animate-slide-up">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-3">Title Length Impact</p>
              <div className="grid grid-cols-3 gap-3">
                {contentPatterns.titleLengths.map((tl) => (
                  <div key={tl.label} className="bg-surface-3 rounded-lg p-3 text-center">
                    <p className="text-sm font-bold text-gray-200">{formatNumber(tl.avgViews)}</p>
                    <p className="text-[10px] text-gray-500">{tl.label}</p>
                    <p className="text-[10px] text-gray-600">{tl.count} videos</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>
      ) : null}

      {/* ─── Section 6: Upload Timing Heatmap ─── */}
      {timingLoading ? (
        <SkeletonChart />
      ) : timing ? (
        <Section title="Upload Timing" subtitle={timing.recommendation || 'Best times to publish based on historical performance'}>
          {/* Heatmap */}
          {timing.heatmap?.length > 0 && (
            <div className="card p-5 animate-slide-up">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-3">Views Heatmap (Day x Hour UTC)</p>
              <div className="overflow-x-auto">
                <div className="min-w-[600px]">
                  {/* Hour labels */}
                  <div className="flex gap-0.5 mb-0.5 pl-12">
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h} className="flex-1 text-center text-[9px] text-gray-600">
                        {h % 3 === 0 ? `${h}` : ''}
                      </div>
                    ))}
                  </div>
                  {/* Grid rows */}
                  {DAYS_OF_WEEK.map((day) => {
                    const dayData = timing.heatmap.filter((c) => c.day === day || c.dayIndex === DAYS_OF_WEEK.indexOf(day));
                    return (
                      <div key={day} className="flex gap-0.5 mb-0.5 items-center">
                        <span className="text-[10px] text-gray-500 w-12 shrink-0 text-right pr-2">{day}</span>
                        {Array.from({ length: 24 }, (_, h) => {
                          const cell = dayData.find((c) => c.hour === h);
                          const val = cell?.avgViews || cell?.value || 0;
                          const maxVal = Math.max(...timing.heatmap.map((c) => c.avgViews || c.value || 0), 1);
                          const intensity = val / maxVal;
                          return (
                            <div
                              key={h}
                              className="flex-1 aspect-square rounded-sm transition-colors"
                              style={{
                                backgroundColor: intensity > 0
                                  ? `rgba(59, 130, 246, ${Math.max(intensity * 0.9, 0.05)})`
                                  : '#1a1a1a',
                              }}
                              title={`${day} ${h}:00 — ${formatNumber(val)} avg views`}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
              {timing.sampleWarning && (
                <p className="text-[10px] text-warning mt-2">{timing.sampleWarning}</p>
              )}
            </div>
          )}

          {/* Day of week bars + top hours */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {timing.byDay?.length > 0 && (
              <div className="card p-5 animate-slide-up">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">By Day of Week</p>
                <div className="space-y-1.5">
                  {timing.byDay.map((d, i) => {
                    const maxViews = timing.byDay[0]?.avgViews || 1;
                    const pct = (d.avgViews / maxViews) * 100;
                    return (
                      <div key={d.day} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-20 shrink-0">{d.day}</span>
                        <div className="flex-1 h-2 bg-surface-4 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${i === 0 ? 'bg-success' : 'bg-accent/60'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-14 text-right tabular-nums">{d.avgViews?.toLocaleString()}</span>
                        <span className="text-[10px] text-gray-600 w-6 text-right">{d.videosPublished}v</span>
                        {d.engagementRate != null && (
                          <span className="text-[10px] text-gray-600 w-12 text-right">{d.engagementRate}% eng</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {timing.byHour?.length > 0 && (
              <div className="card p-5 animate-slide-up">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Top Hours (UTC)</p>
                <div className="space-y-1.5">
                  {timing.byHour.slice(0, 8).map((h) => (
                    <div key={h.hour} className="flex items-center justify-between py-1.5 px-2 bg-surface-3 rounded">
                      <span className="text-xs text-gray-300 font-mono">{h.hourLabel}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">{h.avgViews?.toLocaleString()} avg views</span>
                        {h.engagementRate != null && (
                          <span className="text-[10px] text-gray-600">{h.engagementRate}% eng</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>
      ) : (
        <EmptyState message="Upload timing data not available" />
      )}

      {/* ─── Section 7: Retention Intelligence ─── */}
      {retentionLoading ? (
        <SkeletonChart />
      ) : retention ? (
        <Section title="Retention Intelligence" subtitle="How well videos hold viewer attention">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top retention */}
            {retention.topRetention?.length > 0 && (
              <div className="card p-5 animate-slide-up">
                <p className="text-[10px] uppercase tracking-wider text-success font-semibold mb-3">Best Retention</p>
                <div className="space-y-2">
                  {retention.topRetention.slice(0, 5).map((v) => (
                    <div key={v.video_id} className="flex items-center gap-3 p-2 bg-success/5 border border-success/10 rounded-lg">
                      {v.thumbnail_url && (
                        <img src={v.thumbnail_url} alt="" className="w-14 h-8 rounded object-cover shrink-0" loading="lazy" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-300 truncate">{v.title}</p>
                        <p className="text-[11px] text-gray-500">
                          {formatPercent(v.retentionRate)} retention
                          {v.avgViewDuration ? ` / ${formatDuration(v.avgViewDuration)} avg` : ''}
                        </p>
                      </div>
                      {v.vsAverage != null && (
                        <span className="text-[10px] font-bold text-success">+{formatPercent(v.vsAverage)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom retention */}
            {retention.bottomRetention?.length > 0 && (
              <div className="card p-5 animate-slide-up">
                <p className="text-[10px] uppercase tracking-wider text-danger font-semibold mb-3">Lowest Retention</p>
                <div className="space-y-2">
                  {retention.bottomRetention.slice(0, 5).map((v) => (
                    <div key={v.video_id} className="flex items-center gap-3 p-2 bg-danger/5 border border-danger/10 rounded-lg">
                      {v.thumbnail_url && (
                        <img src={v.thumbnail_url} alt="" className="w-14 h-8 rounded object-cover shrink-0" loading="lazy" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400 truncate">{v.title}</p>
                        <p className="text-[11px] text-gray-500">
                          {formatPercent(v.retentionRate)} retention
                          {v.avgViewDuration ? ` / ${formatDuration(v.avgViewDuration)} avg` : ''}
                        </p>
                      </div>
                      {v.vsAverage != null && (
                        <span className="text-[10px] font-bold text-danger">{formatPercent(v.vsAverage)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Retention trend */}
          {retention.trendData?.length > 0 && (
            <AreaChartCard
              title="Retention Trend"
              subtitle="Channel average retention over time"
              data={retention.trendData}
              dataKeys={['retentionRate']}
              colors={['#8B5CF6']}
              height={220}
            />
          )}

          {retention.channelAvgRetention != null && (
            <div className="card p-4 animate-slide-up flex items-center gap-4">
              <span className="text-xs text-gray-500">Channel Avg Retention:</span>
              <span className="text-sm font-bold text-gray-200">{formatPercent(retention.channelAvgRetention)}</span>
            </div>
          )}

          {!retention.topRetention?.length && !retention.bottomRetention?.length && !retention.trendData?.length && (
            <EmptyState message="Not enough retention data yet" />
          )}
        </Section>
      ) : (
        <EmptyState message="Retention data not available" />
      )}

      {/* ─── Subscriber Engagement ─── */}
      {subEngagementLoading ? (
        <SkeletonChart />
      ) : subEngagement ? (
        <Section title="Subscriber Engagement" subtitle="How your subscribers interact vs non-subscribers">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-4 animate-slide-up text-center">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Sub View Share</p>
              <p className="text-lg font-bold text-gray-100">{subEngagement.subViewShare}%</p>
              <p className="text-[10px] text-gray-500">of total views</p>
            </div>
            <div className="card p-4 animate-slide-up text-center">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Sub Watch Time/View</p>
              <p className="text-lg font-bold text-success">{subEngagement.subscriberWatchTimePerView}m</p>
            </div>
            <div className="card p-4 animate-slide-up text-center">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Non-Sub WT/View</p>
              <p className="text-lg font-bold text-gray-400">{subEngagement.nonSubscriberWatchTimePerView}m</p>
            </div>
            <div className="card p-4 animate-slide-up text-center">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Loyalty Multiplier</p>
              <p className="text-lg font-bold text-accent">{subEngagement.loyaltyMultiplier}x</p>
              <p className="text-[10px] text-gray-500">subs watch longer</p>
            </div>
          </div>

          {/* Correlation card */}
          <div className="card p-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-300">Views ↔ Subscriber Correlation</p>
                <p className="text-[10px] text-gray-500">Pearson r = {subEngagement.correlation}</p>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                subEngagement.correlation > 0.7 ? 'bg-success/15 text-success' :
                subEngagement.correlation > 0.3 ? 'bg-accent/15 text-accent' :
                'bg-surface-4 text-gray-400'
              }`}>
                {subEngagement.correlationLabel}
              </span>
            </div>
          </div>

          {subEngagement.loyaltyTrend?.length > 0 && (
            <AreaChartCard
              title="Subscriber Loyalty Trend"
              subtitle="Daily subscriber view share %"
              data={subEngagement.loyaltyTrend}
              dataKeys={['subViewShare']}
              colors={['#3B82F6']}
              height={200}
            />
          )}
        </Section>
      ) : null}

      {/* ─── Section 8: Traffic Source ROI ─── */}
      {trafficLoading ? (
        <SkeletonChart />
      ) : trafficROI ? (
        <Section title="Traffic Source Quality" subtitle="Efficiency and diversity of traffic sources">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Diversity index gauge */}
            {trafficROI.diversityIndex != null && (
              <div className="card p-5 animate-slide-up flex flex-col items-center justify-center">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Diversity Index</p>
                <MiniGauge score={trafficROI.diversityIndex} size={72} strokeWidth={6} />
                <p className="text-[10px] text-gray-600 mt-2 text-center">
                  {trafficROI.diversityIndex >= 70 ? 'Well diversified' : trafficROI.diversityIndex >= 40 ? 'Moderate diversity' : 'Heavily concentrated'}
                </p>
              </div>
            )}

            {/* Watch time per view by source */}
            {trafficROI.sources?.length > 0 && (
              <div className="card p-5 animate-slide-up lg:col-span-2">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-3">Watch Time Per View (minutes)</p>
                <div className="space-y-2">
                  {trafficROI.sources.slice(0, 8).map((src) => {
                    const maxWT = Math.max(...trafficROI.sources.map((s) => s.watchTimePerView || 0), 1);
                    const pct = ((src.watchTimePerView || 0) / maxWT) * 100;
                    return (
                      <div key={src.source} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-32 shrink-0 truncate">{src.source}</span>
                        <div className="flex-1 h-2 bg-surface-4 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-accent/70 transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-400 w-12 text-right tabular-nums">{(src.watchTimePerView || 0).toFixed(1)}</span>
                        {src.change != null && (
                          <span className={`text-[10px] w-12 text-right font-medium ${src.change > 0 ? 'text-success' : src.change < 0 ? 'text-danger' : 'text-gray-500'}`}>
                            {src.change > 0 ? '+' : ''}{formatPercent(src.change)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Growth/decline per source */}
          {trafficROI.sources?.length > 0 && (
            <div className="card p-5 animate-slide-up">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-3">Source Performance</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {trafficROI.sources.slice(0, 6).map((src) => (
                  <div key={src.source} className="bg-surface-3 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-300 font-medium truncate">{src.source}</span>
                      {src.change != null && (
                        <span className={`text-xs font-bold ${src.change > 0 ? 'text-success' : src.change < 0 ? 'text-danger' : 'text-gray-500'}`}>
                          {src.change > 0 ? '+' : ''}{formatPercent(src.change)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500">{formatNumber(src.views)} views / {formatNumber(src.watchTime)} min watch time</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!trafficROI.sources?.length && !trafficROI.diversityIndex && (
            <EmptyState message="Not enough traffic data for ROI analysis" />
          )}
        </Section>
      ) : (
        <EmptyState message="Traffic ROI data not available" />
      )}

      {/* ─── Upload Gap Impact ─── */}
      {uploadGapsLoading ? (
        <SkeletonChart />
      ) : uploadGaps?.summary ? (
        <Section title="Upload Gap Impact" subtitle="How publishing breaks affect your channel performance">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-4 animate-slide-up text-center">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Active Day Avg</p>
              <p className="text-lg font-bold text-success">{formatNumber(uploadGaps.summary.avgActiveViews)}</p>
              <p className="text-[10px] text-gray-500">views/day</p>
            </div>
            <div className="card p-4 animate-slide-up text-center">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Gap Day Avg</p>
              <p className="text-lg font-bold text-danger">{formatNumber(uploadGaps.summary.avgGapViews)}</p>
              <p className="text-[10px] text-gray-500">views/day</p>
            </div>
            <div className="card p-4 animate-slide-up text-center">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Cost Per Gap Day</p>
              <p className={`text-lg font-bold ${uploadGaps.summary.costPerGapDay < 0 ? 'text-danger' : 'text-success'}`}>
                {uploadGaps.summary.costPerGapDay > 0 ? '+' : ''}{formatNumber(uploadGaps.summary.costPerGapDay)}
              </p>
              <p className="text-[10px] text-gray-500">views diff</p>
            </div>
            <div className="card p-4 animate-slide-up text-center">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">View Impact</p>
              <p className={`text-lg font-bold ${uploadGaps.summary.viewImpactPct < 0 ? 'text-danger' : 'text-success'}`}>
                {uploadGaps.summary.viewImpactPct > 0 ? '+' : ''}{uploadGaps.summary.viewImpactPct}%
              </p>
              <p className="text-[10px] text-gray-500">gap vs active</p>
            </div>
          </div>

          {/* Upload frequency trend */}
          {uploadGaps.frequencyTrend && (
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(uploadGaps.frequencyTrend).map(([period, data]) => (
                <div key={period} className="card p-4 animate-slide-up text-center">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{period}</p>
                  <p className="text-lg font-bold text-gray-100">{data.uploads}</p>
                  <p className="text-[10px] text-gray-500">uploads</p>
                  {data.avgDaysBetween && (
                    <p className="text-xs text-gray-400 mt-1">~{data.avgDaysBetween}d apart</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Gap list */}
          {uploadGaps.gaps?.length > 0 && (
            <div className="card p-5 animate-slide-up">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-3">Longest Gaps</p>
              <div className="space-y-1.5">
                {uploadGaps.gaps.slice(0, 8).map((g, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1.5 px-2 bg-surface-3 rounded">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400">{g.from} → {g.to}</span>
                      <span className="text-warning font-medium">{g.durationDays}d gap</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500">{formatNumber(g.avgDailyViews)} views/d</span>
                      <span className="text-gray-600">{g.avgDailySubs} subs/d</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>
      ) : null}

      {/* Lazy trigger: deeper sections fire when user scrolls this far */}
      <div ref={lazyRef2} />

      {/* ─── Section 9: Outlier Analysis ─── */}
      {outliersLoading ? (
        <SkeletonChart />
      ) : outliers ? (
        <Section title="Performance Outliers" subtitle={`Channel avg: ${formatNumber(outliers.channelMean)} views`}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Breakout videos */}
            {outliers.overperformers?.length > 0 && (
              <div className="card p-5 animate-slide-up">
                <p className="text-[10px] uppercase tracking-wider text-success font-semibold mb-3">Breakout Videos</p>
                <div className="space-y-2">
                  {outliers.overperformers.slice(0, 5).map((v) => (
                    <div key={v.video_id} className="p-2.5 bg-success/5 border border-success/10 rounded-lg">
                      <div className="flex items-center gap-3">
                        {v.thumbnail_url && (
                          <img src={v.thumbnail_url} alt="" className="w-16 h-9 rounded object-cover shrink-0" loading="lazy" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-300 truncate">{v.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-gray-500">{formatNumber(v.views)} views</span>
                            {v.velocity != null && (
                              <span className="text-[10px] text-gray-600">{formatNumber(v.velocity)} views/day</span>
                            )}
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            v.label === 'viral' ? 'bg-purple-500/20 text-purple-400' : 'bg-success/20 text-success'
                          }`}
                        >
                          {v.z_score}x
                        </span>
                      </div>
                      {v.why && (
                        <p className="text-[10px] text-gray-500 mt-1.5 pl-1 border-l-2 border-success/20 ml-1">{v.why}</p>
                      )}
                      {v.topTrafficSource && (
                        <p className="text-[10px] text-gray-600 mt-1">Top source: {v.topTrafficSource}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Underperforming videos */}
            {outliers.underperformers?.length > 0 && (
              <div className="card p-5 animate-slide-up">
                <p className="text-[10px] uppercase tracking-wider text-danger font-semibold mb-3">Underperforming</p>
                <div className="space-y-2">
                  {outliers.underperformers.slice(0, 5).map((v) => (
                    <div key={v.video_id} className="p-2.5 bg-danger/5 border border-danger/10 rounded-lg">
                      <div className="flex items-center gap-3">
                        {v.thumbnail_url && (
                          <img src={v.thumbnail_url} alt="" className="w-16 h-9 rounded object-cover shrink-0" loading="lazy" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-400 truncate">{v.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-gray-500">{formatNumber(v.views)} views</span>
                            {v.velocity != null && (
                              <span className="text-[10px] text-gray-600">{formatNumber(v.velocity)} views/day</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {v.why && (
                        <p className="text-[10px] text-gray-500 mt-1.5 pl-1 border-l-2 border-danger/20 ml-1">{v.why}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {!outliers.overperformers?.length && !outliers.underperformers?.length && (
            <EmptyState message="Not enough data for outlier detection" />
          )}
        </Section>
      ) : (
        <EmptyState message="Outlier data not available" />
      )}
    </div>
  );
}

/* ─── Grouped insights renderer ─── */

function renderGroupedInsights(insights) {
  // Group by category if present, else render flat
  const hasCategories = insights.some((i) => i.category);

  if (!hasCategories) {
    return (
      <div className="space-y-2">
        {insights.map((insight, i) => (
          <InsightRow key={i} insight={insight} />
        ))}
      </div>
    );
  }

  const grouped = {};
  insights.forEach((insight) => {
    const cat = insight.category || 'General';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(insight);
  });

  return (
    <div className="space-y-5">
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">{category}</p>
          <div className="space-y-2">
            {items.map((insight, i) => (
              <InsightRow key={i} insight={insight} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function InsightRow({ insight }) {
  const style = INSIGHT_ICONS[insight.type] || INSIGHT_ICONS.info;
  return (
    <div className={`flex items-start gap-3 px-3 py-2 rounded-lg ${style.bg}`}>
      <span className={`mt-0.5 shrink-0 ${style.color}`}>
        <InsightIcon type={insight.type} />
      </span>
      <div>
        {insight.title && <p className="text-xs font-semibold text-gray-300">{insight.title}</p>}
        <p className="text-xs text-gray-400">{insight.text}</p>
      </div>
    </div>
  );
}
