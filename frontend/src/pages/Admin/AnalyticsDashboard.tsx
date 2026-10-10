import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Calendar, 
  TrendingUp, 
  AlertTriangle, 
  FileText, 
  Clock, 
  Activity, 
  Building2, 
  RefreshCw,
  Sparkles,
  BarChart3,
  ShieldAlert,
  Layers
} from 'lucide-react';
import { API_URL } from '@/lib/api';

interface DayCount {
  date: string;
  count: number;
}

interface ComplaintCount {
  complaint: string;
  count: number;
}

interface AnalyticsData {
  total_sessions: number;
  sessions_by_day: DayCount[];
  red_flag_count: number;
  top_complaints: ComplaintCount[];
  avg_session_duration_seconds: number | null;
  ocr_documents_count: number;
  ayush_assessments_count: number;
}

export default function AnalyticsDashboard() {
  const params = useParams<{ id?: string; hospitalId?: string }>();
  const hospitalId = params.id || params.hospitalId || '';
  const navigate = useNavigate();

  const [range, setRange] = useState<'7d' | '30d' | '90d'>('7d');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [hospitalName, setHospitalName] = useState<string>('Hospital');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{ date: string; count: number; x: number; y: number } | null>(null);

  const getAuthToken = () => {
    return localStorage.getItem('admin_token') || localStorage.getItem('doctor_token') || localStorage.getItem('triage_token') || 'mock-superadmin-token';
  };

  const fetchAnalytics = async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    setError(null);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_URL}/api/analytics/hospital/${hospitalId}?range=${range}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error(`Failed to load analytics (HTTP ${res.status})`);
      }

      const json = await res.json();
      setData(json);
    } catch (err: any) {
      console.error('Fetch analytics error:', err);
      setError(err?.message || 'Error loading hospital analytics');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Fetch hospital name
    if (hospitalId) {
      fetch(`${API_URL}/api/hospitals/${hospitalId}`)
        .then(r => r.json())
        .then(h => {
          if (h && (h.hospital_name || h.name)) {
            setHospitalName(h.hospital_name || h.name);
          }
        })
        .catch(() => {});
    }
  }, [hospitalId]);

  useEffect(() => {
    fetchAnalytics();
  }, [hospitalId, range]);

  // Format seconds to human readable minutes/seconds
  const formatDuration = (seconds: number | null) => {
    if (seconds === null || seconds === undefined) return 'N/A';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const remSec = seconds % 60;
    return remSec > 0 ? `${mins}m ${remSec}s` : `${mins}m`;
  };

  // SVG Line Chart calculations
  const renderLineChart = () => {
    if (!data || !data.sessions_by_day || data.sessions_by_day.length === 0) return null;

    const points = data.sessions_by_day;
    const width = 700;
    const height = 220;
    const paddingLeft = 45;
    const paddingRight = 25;
    const paddingTop = 25;
    const paddingBottom = 40;

    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;

    const maxCount = Math.max(4, ...points.map(p => p.count));
    const stepX = points.length > 1 ? plotWidth / (points.length - 1) : plotWidth;

    const coords = points.map((p, idx) => {
      const x = paddingLeft + idx * stepX;
      const y = paddingTop + plotHeight - (p.count / maxCount) * plotHeight;
      return { ...p, x, y };
    });

    const pathD = coords.reduce((acc, c, idx) => {
      return `${acc} ${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`;
    }, '');

    const areaD = `${pathD} L ${coords[coords.length - 1].x.toFixed(1)} ${(paddingTop + plotHeight).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(paddingTop + plotHeight).toFixed(1)} Z`;

    // Grid ticks (0, mid, max)
    const yTicks = [0, Math.ceil(maxCount / 2), maxCount];

    // Date labels on X-axis (start, mid, end)
    const labelIndices = [0, Math.floor((points.length - 1) / 2), points.length - 1];

    return (
      <div className="relative w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto max-h-64 select-none">
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1B5E4A" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#1B5E4A" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid lines */}
          {yTicks.map(val => {
            const y = paddingTop + plotHeight - (val / maxCount) * plotHeight;
            return (
              <g key={val}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#E8E5DF"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="text-[11px] font-mono fill-muted font-bold"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          <path d={areaD} fill="url(#chartGradient)" />

          {/* Main sparkline */}
          <path
            d={pathD}
            fill="none"
            stroke="#1B5E4A"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interactive dots */}
          {coords.map((c, idx) => (
            <circle
              key={idx}
              cx={c.x}
              cy={c.y}
              r={hoveredPoint?.date === c.date ? 6 : points.length > 35 ? 2.5 : 4}
              className="fill-white stroke-primary cursor-pointer transition-all duration-150"
              strokeWidth={hoveredPoint?.date === c.date ? 3 : 2}
              onMouseEnter={() => setHoveredPoint(c)}
              onMouseLeave={() => setHoveredPoint(null)}
            />
          ))}

          {/* X-axis labels */}
          {labelIndices.map(idx => {
            const c = coords[idx];
            if (!c) return null;
            return (
              <text
                key={idx}
                x={c.x}
                y={height - 12}
                textAnchor={idx === 0 ? 'start' : idx === points.length - 1 ? 'end' : 'middle'}
                className="text-[11px] font-mono fill-muted font-semibold"
              >
                {c.date}
              </text>
            );
          })}
        </svg>

        {/* Floating Tooltip */}
        {hoveredPoint && (
          <div
            style={{
              left: `${(hoveredPoint.x / width) * 100}%`,
              top: `${(hoveredPoint.y / height) * 100}%`
            }}
            className="absolute -translate-x-1/2 -translate-y-12 pointer-events-none bg-charcoal text-white text-xs font-semibold px-2.5 py-1 rounded-lg shadow-lg border border-warmgray/20 whitespace-nowrap z-20"
          >
            <span>{hoveredPoint.date}: </span>
            <strong className="text-turmeric">{hoveredPoint.count} session{hoveredPoint.count === 1 ? '' : 's'}</strong>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-sand font-body text-charcoal pb-16">
      {/* Top Navigation Header */}
      <header className="bg-white border-b border-warmgray sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin/hospitals')}
              className="p-2 text-muted hover:text-charcoal hover:bg-sand rounded-xl transition"
              title="Back to Hospitals"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-bold text-charcoal leading-tight">
                  Hospital Analytics
                </h1>
                <p className="text-xs text-muted truncate max-w-[200px] sm:max-w-xs">
                  {hospitalName}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Period selector (pill toggle) */}
            <div className="flex items-center bg-sand border border-warmgray p-1 rounded-xl">
              {(['7d', '30d', '90d'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setRange(p)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    range === p
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-muted hover:text-charcoal'
                  }`}
                >
                  {p.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              onClick={() => fetchAnalytics(true)}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-warmgray bg-white hover:bg-sand text-xs font-semibold text-charcoal transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary' : 'text-muted'}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Banner summary */}
        <div className="bg-white rounded-2xl border-2 border-warmgray p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-display font-bold text-charcoal">
              Facility Performance & Triage Trends
            </h2>
            <p className="text-sm text-muted">
              Aggregated throughput metrics for <span className="font-semibold text-charcoal">{hospitalName}</span> over the past {range.replace('d', ' days')}.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted bg-sand px-3 py-1.5 rounded-xl border border-warmgray flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              Window: Past {range.replace('d', ' Days')}
            </span>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-danger/10 border border-danger/30 rounded-xl text-danger text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isLoading ? (
          /* Loading State: Skeleton Cards + Skeleton Chart */
          <div className="space-y-6 animate-pulse">
            {/* Skeleton Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-warmgray p-5 space-y-3 shadow-xs">
                  <div className="h-4 bg-sand rounded w-1/2" />
                  <div className="h-8 bg-sand rounded w-3/4" />
                  <div className="h-3 bg-sand rounded w-1/3" />
                </div>
              ))}
            </div>

            {/* Skeleton Line Chart */}
            <div className="bg-white rounded-2xl border border-warmgray p-6 space-y-4 shadow-xs">
              <div className="h-5 bg-sand rounded w-1/4" />
              <div className="h-48 bg-sand/60 rounded-xl w-full" />
            </div>

            {/* Skeleton Complaints List */}
            <div className="bg-white rounded-2xl border border-warmgray p-6 space-y-3 shadow-xs">
              <div className="h-5 bg-sand rounded w-1/3" />
              <div className="space-y-2 pt-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-8 bg-sand rounded-xl w-full" />
                ))}
              </div>
            </div>
          </div>
        ) : !data || data.total_sessions === 0 ? (
          /* Empty State: "No data for this period" */
          <div className="bg-white rounded-2xl border border-warmgray p-12 text-center shadow-xs">
            <div className="w-16 h-16 rounded-full bg-sand text-muted border border-warmgray flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-8 h-8 text-primary/60" />
            </div>
            <h3 className="text-lg font-bold text-charcoal mb-1">No data for this period</h3>
            <p className="text-sm text-muted max-w-md mx-auto mb-6">
              There are no recorded patient intake sessions for this facility during the selected {range.replace('d', ' days')} window.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setRange('90d')}
                className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition shadow-xs"
              >
                Expand to 90 Days
              </button>
              <button
                onClick={() => navigate('/admin/hospitals')}
                className="px-4 py-2 rounded-xl bg-white border border-warmgray text-charcoal text-xs font-semibold hover:bg-sand transition"
              >
                Back to Registry
              </button>
            </div>
          </div>
        ) : (
          /* Full Data View */
          <div className="space-y-6">
            {/* ── BIG NUMBER CARDS ROW ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Sessions */}
              <div className="bg-white rounded-2xl border-2 border-warmgray p-5 shadow-xs hover:border-primary/40 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-muted uppercase tracking-wider">Total Sessions</span>
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Activity className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-3xl font-display font-bold text-charcoal leading-tight">
                  {data.total_sessions}
                </p>
                <p className="text-xs text-muted mt-1.5 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  Patient visits in {range.replace('d', 'd')}
                </p>
              </div>

              {/* Red Flags */}
              <div className={`bg-white rounded-2xl border-2 p-5 shadow-xs transition-colors ${data.red_flag_count > 0 ? 'border-danger/40' : 'border-warmgray'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-danger uppercase tracking-wider">Red Flags</span>
                  <div className="w-8 h-8 rounded-lg bg-danger/10 text-danger flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-3xl font-display font-bold text-danger leading-tight">
                  {data.red_flag_count}
                </p>
                <p className="text-xs text-danger/70 mt-1.5 font-medium">
                  {data.red_flag_count === 1 ? '1 emergency case' : `${data.red_flag_count} emergency cases`}
                </p>
              </div>

              {/* Documents Processed (OCR) */}
              <div className="bg-white rounded-2xl border-2 border-warmgray p-5 shadow-xs hover:border-primary/40 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-muted uppercase tracking-wider">Docs Processed</span>
                  <div className="w-8 h-8 rounded-lg bg-terracotta/10 text-terracotta flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-3xl font-display font-bold text-charcoal leading-tight">
                  {data.ocr_documents_count}
                </p>
                <p className="text-xs text-muted mt-1.5">
                  OCR reports & prescriptions
                </p>
              </div>

              {/* Avg Session Duration */}
              <div className="bg-white rounded-2xl border-2 border-warmgray p-5 shadow-xs hover:border-primary/40 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-muted uppercase tracking-wider">Avg Intake Time</span>
                  <div className="w-8 h-8 rounded-lg bg-turmeric/20 text-charcoal flex items-center justify-center">
                    <Clock className="w-4 h-4 text-turmeric" />
                  </div>
                </div>
                <p className="text-3xl font-display font-bold text-charcoal leading-tight">
                  {formatDuration(data.avg_session_duration_seconds)}
                </p>
                <p className="text-xs text-muted mt-1.5">
                  Start to summary generated
                </p>
              </div>
            </div>

            {/* ── SESSIONS PER DAY (SVG SPARKLINE) ── */}
            <section className="bg-white rounded-2xl border-2 border-warmgray p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-warmgray/60 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-display font-bold text-charcoal">
                      Sessions Per Day
                    </h3>
                    <p className="text-xs text-muted">Daily patient intake trend over {range.replace('d', ' days')}</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">
                    {data.sessions_by_day.length} data points
                  </span>
                </div>
              </div>

              {/* Responsive SVG Chart */}
              {renderLineChart()}
            </section>

            {/* ── TOP 5 COMPLAINTS BAR LIST & AYUSH STATS ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Top 5 Complaints */}
              <section className="lg:col-span-2 bg-white rounded-2xl border-2 border-warmgray p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-warmgray/60 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-sand text-charcoal border border-warmgray flex items-center justify-center">
                      <Layers className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-base font-display font-bold text-charcoal">
                        Top 5 Chief Complaints
                      </h3>
                      <p className="text-xs text-muted">Most frequent patient presentations</p>
                    </div>
                  </div>
                </div>

                {data.top_complaints.length === 0 ? (
                  <p className="text-xs text-muted italic py-6 text-center">No complaints recorded for this period.</p>
                ) : (
                  <div className="space-y-3.5 pt-1">
                    {(() => {
                      const maxComplaintCount = Math.max(1, ...data.top_complaints.map(c => c.count));
                      return data.top_complaints.map((item, idx) => {
                        const percent = Math.round((item.count / maxComplaintCount) * 100);
                        return (
                          <div key={idx} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-charcoal flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-sand border border-warmgray text-[10px] font-bold text-charcoal flex items-center justify-center">
                                  {idx + 1}
                                </span>
                                {item.complaint}
                              </span>
                              <span className="font-bold text-charcoal font-mono bg-sand px-2 py-0.5 rounded-md border border-warmgray">
                                {item.count} case{item.count === 1 ? '' : 's'}
                              </span>
                            </div>
                            <div className="w-full bg-sand rounded-full h-2 overflow-hidden border border-warmgray/60">
                              <div
                                className="h-full bg-primary rounded-full transition-all duration-500"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </section>

              {/* Protocol Breakdown / Secondary Stats */}
              <section className="bg-white rounded-2xl border-2 border-warmgray p-6 shadow-xs flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center gap-2 border-b border-warmgray/60 pb-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-terracotta/10 text-terracotta flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-display font-bold text-charcoal">
                        Protocol Breakdown
                      </h3>
                      <p className="text-xs text-muted">Intake distribution</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-sand/60 p-4 rounded-xl border border-warmgray/70">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-muted uppercase tracking-wider">AYUSH Assessments</span>
                        <span className="font-bold text-terracotta font-mono text-sm">{data.ayush_assessments_count}</span>
                      </div>
                      <p className="text-[11px] text-muted">
                        Prakriti & holistic dimensional evaluations conducted.
                      </p>
                    </div>

                    <div className="bg-sand/60 p-4 rounded-xl border border-warmgray/70">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-muted uppercase tracking-wider">Allopathic Triage</span>
                        <span className="font-bold text-primary font-mono text-sm">{data.total_sessions}</span>
                      </div>
                      <p className="text-[11px] text-muted">
                        Standard symptom assessment and clinical review.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-warmgray/60 text-center">
                  <button
                    onClick={() => navigate(`/hospital/${hospitalId}/triage`)}
                    className="w-full py-2.5 rounded-xl bg-sand hover:bg-warmgray/40 border border-warmgray text-xs font-bold text-charcoal transition flex items-center justify-center gap-1.5"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-danger" />
                    Open Triage Alerts Queue →
                  </button>
                </div>
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
