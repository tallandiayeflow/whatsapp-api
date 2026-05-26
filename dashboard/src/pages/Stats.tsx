import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Clock,
  Code2,
  Layers,
  MemoryStick,
  HardDrive,
  Database,
  MessageSquare,
  ArrowDownLeft,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useSessionsQuery } from '../hooks/queries';
import { PageHeader } from '../components/PageHeader';
import { statsApi } from '../services/api';
import './Stats.css';

export function Stats() {
  const { t } = useTranslation();
  useDocumentTitle(t('stats.title'));

  const { data: sessions = [], isLoading: loadingSessions } = useSessionsQuery();

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

  const formatLastActive = (date?: string) => {
    if (!date) return t('common.never');
    const diff = Date.now() - new Date(date).getTime();
    if (diff < 60000) return t('common.justNow');
    if (diff < 3600000) return t('common.minAgo', { count: Math.floor(diff / 60000) });
    if (diff < 86400000) return t('common.hoursAgo', { count: Math.floor(diff / 3600000) });
    return new Date(date).toLocaleDateString();
  };

  const formatStatus = (status: string) => t(`sessionStatus.${status}`, { defaultValue: status });

  return (
    <div className="stats-page">
      <PageHeader title={t('stats.title')} subtitle={t('stats.subtitle')} />

      {/* System Metrics — Row 1: Uptime, Node version, Environment */}
      <div className="stats-section-label">{t('stats.systemMetrics', { defaultValue: 'System Metrics' })}</div>

      {loadingSystem ? (
        <div className="stats-loading-row">
          <Loader2 className="animate-spin" size={24} />
        </div>
      ) : (
        <>
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
          </div>

          {/* System Metrics — Row 2: Heap used, RSS memory, Queue status */}
          <div className="stats-grid stats-grid-3">
            {/* Heap used */}
            <div className="stat-card">
              <MemoryStick className="stat-watermark" />
              <div className="stat-header">
                <span className="stat-label">{t('stats.cards.heapUsed', { defaultValue: 'Heap Used' })}</span>
                <MemoryStick size={20} className="stat-icon" />
              </div>
              <div className="stat-value">
                {systemMetrics != null ? `${systemMetrics.memory.heapUsedMb} MB` : '—'}
              </div>
            </div>

            {/* RSS memory */}
            <div className="stat-card">
              <HardDrive className="stat-watermark" />
              <div className="stat-header">
                <span className="stat-label">{t('stats.cards.rssMemory', { defaultValue: 'RSS Memory' })}</span>
                <HardDrive size={20} className="stat-icon" />
              </div>
              <div className="stat-value">
                {systemMetrics != null ? `${systemMetrics.memory.rssMb} MB` : '—'}
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
        </>
      )}

      {/* Message Stats */}
      <div className="stats-section-label">{t('stats.messageStats', { defaultValue: 'Message Statistics' })}</div>

      {loadingOverview ? (
        <div className="stats-loading-row">
          <Loader2 className="animate-spin" size={24} />
        </div>
      ) : (
        <div className="stats-grid stats-grid-3">
          {/* Messages today sent */}
          <div className="stat-card">
            <MessageSquare className="stat-watermark" />
            <div className="stat-header">
              <span className="stat-label">{t('stats.cards.todaySent', { defaultValue: 'Sent Today' })}</span>
              <MessageSquare size={20} className="stat-icon" />
            </div>
            <div className="stat-value">
              {(overview?.messages.today.sent ?? 0).toLocaleString()}
            </div>
          </div>

          {/* Messages today received */}
          <div className="stat-card">
            <ArrowDownLeft className="stat-watermark" />
            <div className="stat-header">
              <span className="stat-label">{t('stats.cards.todayReceived', { defaultValue: 'Received Today' })}</span>
              <ArrowDownLeft size={20} className="stat-icon" />
            </div>
            <div className="stat-value">
              {(overview?.messages.today.received ?? 0).toLocaleString()}
            </div>
          </div>

          {/* Messages failed */}
          <div className="stat-card">
            <AlertTriangle className="stat-watermark" />
            <div className="stat-header">
              <span className="stat-label">{t('stats.cards.failed', { defaultValue: 'Failed' })}</span>
              <AlertTriangle size={20} className="stat-icon" />
            </div>
            <div className="stat-value">
              {(overview?.messages.failed ?? 0).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Sessions Table */}
      <section className="stats-table-section">
        <div className="section-header">
          <h2>{t('stats.sessionsTable')}</h2>
          <span className="section-subtitle">
            {loadingSessions ? (
              <Loader2 className="animate-spin" size={14} style={{ display: 'inline-block' }} />
            ) : (
              <>
                {sessions.length} {t('sessions.title').toLowerCase()}
              </>
            )}
          </span>
        </div>

        {loadingSessions ? (
          <div className="stats-loading-row">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : (
          <div className="sessions-table">
            <div className="table-header">
              <span>{t('stats.columns.name')}</span>
              <span>{t('stats.columns.phone')}</span>
              <span>{t('stats.columns.status')}</span>
              <span>{t('stats.columns.lastActive')}</span>
            </div>
            {sessions.length === 0 ? (
              <div className="table-row" style={{ justifyContent: 'center', color: 'var(--text-muted)' }}>
                {t('stats.noSessions')}
              </div>
            ) : (
              sessions.map(session => (
                <div key={session.id} className="table-row">
                  <div className="session-info-cell">
                    <span className="session-id">{session.id.substring(0, 12)}</span>
                    <span className="session-name" title={session.name}>
                      {session.name}
                    </span>
                  </div>
                  <span className="phone">{session.phone ?? '—'}</span>
                  <span className={`status-pill ${session.status}`}>{formatStatus(session.status)}</span>
                  <span className="last-active">{formatLastActive(session.lastActive)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
}
