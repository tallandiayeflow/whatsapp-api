import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import {
  Clock,
  Code2,
  Layers,
  Database,
  MessageSquare,
  ArrowDownLeft,
  ArrowUpRight,
  Users,
  Loader2,
} from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PageHeader } from '../components/PageHeader';
import { statsApi } from '../services/api';
import './Stats.css';

// ─── Timestamp formatter ─────────────────────────────────────────────────────

function formatTimestamp(ts: string, period: '24h' | '7d' | '30d'): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  if (period === '24h') {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Stats() {
  const { t } = useTranslation();
  useDocumentTitle(t('stats.title'));

  const [period, setPeriod] = useState<'24h' | '7d' | '30d'>('24h');

  const { data: systemMetrics, isLoading: loadingSystem } = useQuery({
    queryKey: ['stats', 'system'],
    queryFn: statsApi.getSystemMetrics,
    staleTime: 30_000,
  });

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['stats', 'overview'],
    queryFn: statsApi.getOverview,
    staleTime: 30_000,
  });

  const { data: messageStats, isLoading: loadingMessages } = useQuery({
    queryKey: ['stats', 'messages', period],
    queryFn: () => statsApi.getMessageStats(period),
    staleTime: 30_000,
  });

  // Derived values
  const todaySent = overview?.messages.today.sent ?? 0;
  const todayReceived = overview?.messages.today.received ?? 0;
  const totalSent = overview?.messages.sent ?? 0;
  const totalReceived = overview?.messages.received ?? 0;
  const activeSessions = overview?.sessions.active ?? systemMetrics?.sessionsActive ?? 0;

  const heapUsed = systemMetrics?.memory.heapUsed ?? 0;
  const heapTotal = systemMetrics?.memory.heapTotal ?? 0;
  const heapPct = heapTotal > 0 ? Math.round((heapUsed / heapTotal) * 100) : 0;

  // Chart data — attach formatted label for X axis
  const chartData = (messageStats?.timeSeries ?? []).map((pt) => ({
    ...pt,
    label: formatTimestamp(pt.timestamp, period),
  }));

  const periodLabels: Record<'24h' | '7d' | '30d', string> = {
    '24h': '24h',
    '7d': '7 days',
    '30d': '30 days',
  };

  const periodSelector = (
    <div className="stats-period-selector">
      {(['24h', '7d', '30d'] as const).map((p) => (
        <button
          key={p}
          className={`stats-period-btn${period === p ? ' active' : ''}`}
          onClick={() => setPeriod(p)}
        >
          {periodLabels[p]}
        </button>
      ))}
    </div>
  );

  return (
    <div className="stats-page">
      <PageHeader
        title={t('stats.title')}
        subtitle={t('stats.subtitle')}
        actions={periodSelector}
      />

      {/* ── Top metrics row ──────────────────────────────────────────────── */}
      {loadingOverview || loadingSystem ? (
        <div className="stats-loading-row">
          <Loader2 className="animate-spin" size={24} />
        </div>
      ) : (
        <div className="stats-grid stats-grid-4">
          {/* Active sessions */}
          <div className="stat-card stat-card--green">
            <Users className="stat-watermark" />
            <div className="stat-header">
              <span className="stat-label">Active Sessions</span>
              <Users size={20} className="stat-icon" />
            </div>
            <div className="stat-value">{activeSessions.toLocaleString()}</div>
          </div>

          {/* Messages today */}
          <div className="stat-card stat-card--blue">
            <MessageSquare className="stat-watermark" />
            <div className="stat-header">
              <span className="stat-label">Messages Today</span>
              <MessageSquare size={20} className="stat-icon" />
            </div>
            <div className="stat-value">
              {(todaySent + todayReceived).toLocaleString()}
            </div>
          </div>

          {/* Total sent */}
          <div className="stat-card stat-card--emerald">
            <ArrowUpRight className="stat-watermark" />
            <div className="stat-header">
              <span className="stat-label">Total Sent</span>
              <ArrowUpRight size={20} className="stat-icon" />
            </div>
            <div className="stat-value">{totalSent.toLocaleString()}</div>
          </div>

          {/* Total received */}
          <div className="stat-card stat-card--indigo">
            <ArrowDownLeft className="stat-watermark" />
            <div className="stat-header">
              <span className="stat-label">Total Received</span>
              <ArrowDownLeft size={20} className="stat-icon" />
            </div>
            <div className="stat-value">{totalReceived.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* ── Area chart ───────────────────────────────────────────────────── */}
      <div className="stats-chart-card">
        <h3 className="chart-title">Messages Over Time</h3>
        {loadingMessages ? (
          <div className="stats-loading-row">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : (
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#25d366" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#25d366" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradReceived" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-white)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '0.8125rem',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '0.8125rem' }} />
                <Area
                  type="monotone"
                  dataKey="sent"
                  name="Sent"
                  stroke="#25d366"
                  strokeWidth={2}
                  fill="url(#gradSent)"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Area
                  type="monotone"
                  dataKey="received"
                  name="Received"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#gradReceived)"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Memory usage bar ─────────────────────────────────────────────── */}
      {!loadingSystem && systemMetrics && (
        <div className="stats-chart-card">
          <h3 className="chart-title">Memory Usage</h3>
          <div className="memory-bar-container">
            <div className="memory-bar-labels">
              <span>
                Heap used: {systemMetrics.memory.heapUsedMb} MB / {systemMetrics.memory.heapTotalMb} MB
              </span>
              <span className="memory-bar-pct">{heapPct}%</span>
            </div>
            <div className="memory-bar-track">
              <div
                className="memory-bar-fill"
                style={{ width: `${heapPct}%` }}
              />
            </div>
            <div className="memory-bar-sublabel">
              RSS: {systemMetrics.memory.rssMb} MB
            </div>
          </div>
        </div>
      )}

      {/* ── Session activity (bySession) ─────────────────────────────────── */}
      {(messageStats?.bySession?.length ?? 0) > 0 && (
        <div className="stats-chart-card">
          <h3 className="chart-title">Session Activity</h3>
          {loadingMessages ? (
            <div className="stats-loading-row">
              <Loader2 className="animate-spin" size={24} />
            </div>
          ) : (
            <table className="session-activity-table">
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Sent</th>
                  <th>Received</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {(messageStats?.bySession ?? []).map((s) => (
                  <tr key={s.sessionId}>
                    <td>
                      <span className="session-activity-name">{s.name || s.sessionId}</span>
                      {s.name && (
                        <span className="session-activity-id">{s.sessionId.substring(0, 8)}</span>
                      )}
                    </td>
                    <td className="session-activity-sent">{s.sent.toLocaleString()}</td>
                    <td className="session-activity-received">{s.received.toLocaleString()}</td>
                    <td className="session-activity-total">
                      {(s.sent + s.received).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── System metrics cards ─────────────────────────────────────────── */}
      <div className="stats-section-label" style={{ marginTop: '0.5rem' }}>System Metrics</div>

      {loadingSystem ? (
        <div className="stats-loading-row">
          <Loader2 className="animate-spin" size={24} />
        </div>
      ) : (
        <div className="stats-grid stats-grid-3">
          {/* Uptime */}
          <div className="stat-card">
            <Clock className="stat-watermark" />
            <div className="stat-header">
              <span className="stat-label">{t('stats.cards.uptime', { defaultValue: 'Uptime' })}</span>
              <Clock size={20} className="stat-icon" />
            </div>
            <div className="stat-value">{systemMetrics?.uptimeHuman ?? '—'}</div>
          </div>

          {/* Node.js version */}
          <div className="stat-card">
            <Code2 className="stat-watermark" />
            <div className="stat-header">
              <span className="stat-label">{t('stats.cards.nodeVersion', { defaultValue: 'Node.js Version' })}</span>
              <Code2 size={20} className="stat-icon" />
            </div>
            <div className="stat-value stat-value-sm">{systemMetrics?.nodeVersion ?? '—'}</div>
          </div>

          {/* Environment */}
          <div className="stat-card">
            <Layers className="stat-watermark" />
            <div className="stat-header">
              <span className="stat-label">{t('stats.cards.environment', { defaultValue: 'Environment' })}</span>
              <Layers size={20} className="stat-icon" />
            </div>
            <div className="stat-value stat-value-sm">
              {systemMetrics ? (
                <span className={`env-badge env-badge-${systemMetrics.env}`}>
                  {systemMetrics.env}
                </span>
              ) : '—'}
            </div>
          </div>

          {/* Queue status */}
          <div className="stat-card">
            <Database className="stat-watermark" />
            <div className="stat-header">
              <span className="stat-label">{t('stats.cards.queueStatus', { defaultValue: 'Queue Status' })}</span>
              <Database size={20} className="stat-icon" />
            </div>
            <div className="stat-value stat-value-sm">
              {systemMetrics != null ? (
                <span className={`queue-badge ${systemMetrics.queueEnabled ? 'queue-enabled' : 'queue-disabled'}`}>
                  {systemMetrics.queueEnabled
                    ? t('stats.queueEnabled', { defaultValue: 'Enabled' })
                    : t('stats.queueDisabled', { defaultValue: 'Disabled' })}
                </span>
              ) : '—'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
