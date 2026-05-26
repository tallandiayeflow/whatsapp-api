import { useTranslation } from 'react-i18next';
import { Users, CheckCircle, WifiOff, HardDrive, Loader2 } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useSessionsQuery, useSessionStatsQuery } from '../hooks/queries';
import { PageHeader } from '../components/PageHeader';
import './Stats.css';

export function Stats() {
  const { t } = useTranslation();
  useDocumentTitle(t('stats.title'));

  const { data: sessions = [], isLoading: loadingSessions } = useSessionsQuery();
  const { data: stats, isLoading: loadingStats } = useSessionStatsQuery();

  const loading = loadingSessions || loadingStats;

  const formatMemory = (bytes: number) => {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(0)} MB`;
  };

  const formatLastActive = (date?: string) => {
    if (!date) return t('common.never');
    const diff = Date.now() - new Date(date).getTime();
    if (diff < 60000) return t('common.justNow');
    if (diff < 3600000) return t('common.minAgo', { count: Math.floor(diff / 60000) });
    if (diff < 86400000) return t('common.hoursAgo', { count: Math.floor(diff / 3600000) });
    return new Date(date).toLocaleDateString();
  };

  const formatStatus = (status: string) => t(`sessionStatus.${status}`, { defaultValue: status });

  const statsCards = [
    {
      label: t('stats.cards.total'),
      value: stats?.total ?? 0,
      icon: Users,
    },
    {
      label: t('stats.cards.active'),
      value: stats?.ready ?? 0,
      icon: CheckCircle,
    },
    {
      label: t('stats.cards.disconnected'),
      value: stats?.disconnected ?? 0,
      icon: WifiOff,
    },
    {
      label: t('stats.cards.memory'),
      value: stats ? formatMemory(stats.memoryUsage.heapUsed) : '—',
      icon: HardDrive,
    },
  ];

  if (loading) {
    return (
      <div
        className="stats-page"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}
      >
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="stats-page">
      <PageHeader title={t('stats.title')} subtitle={t('stats.subtitle')} />

      <div className="stats-grid">
        {statsCards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="stat-card">
            <Icon className="stat-watermark" />
            <div className="stat-header">
              <span className="stat-label">{label}</span>
              <Icon size={20} className="stat-icon" />
            </div>
            <div className="stat-value">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </div>
          </div>
        ))}
      </div>

      <section className="stats-table-section">
        <div className="section-header">
          <h2>{t('stats.sessionsTable')}</h2>
          <span className="section-subtitle">
            {sessions.length} {t('sessions.title').toLowerCase()}
          </span>
        </div>

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
                <span className="phone">{session.phone || '—'}</span>
                <span className={`status-pill ${session.status}`}>{formatStatus(session.status)}</span>
                <span className="last-active">{formatLastActive(session.lastActive)}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
