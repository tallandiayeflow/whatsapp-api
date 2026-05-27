import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Search, Filter, Loader2, FileText, RefreshCw, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { AuditLog } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLogsQuery } from '../hooks/queries';
import { PageHeader } from '../components/PageHeader';
import './Logs.css';

const ACTION_GROUPS = [
  { label: 'Sessions', actions: ['session_created','session_started','session_stopped','session_deleted','session_qr_generated','session_connected','session_disconnected'] },
  { label: 'Messages', actions: ['message_sent','message_failed'] },
  { label: 'Webhooks', actions: ['webhook_created','webhook_deleted','webhook_triggered','webhook_failed'] },
  { label: 'Clés API', actions: ['api_key_created','api_key_used','api_key_revoked','api_key_deleted','api_key_auth_failed'] },
];

const ACTION_LABELS: Record<string, string> = {
  session_created: 'Session créée',
  session_started: 'Session démarrée',
  session_stopped: 'Session arrêtée',
  session_deleted: 'Session supprimée',
  session_qr_generated: 'QR généré',
  session_connected: 'Session connectée',
  session_disconnected: 'Session déconnectée',
  message_sent: 'Message envoyé',
  message_failed: 'Message échoué',
  webhook_created: 'Webhook créé',
  webhook_deleted: 'Webhook supprimé',
  webhook_triggered: 'Webhook déclenché',
  webhook_failed: 'Webhook échoué',
  api_key_created: 'Clé créée',
  api_key_used: 'Clé utilisée',
  api_key_revoked: 'Clé révoquée',
  api_key_deleted: 'Clé supprimée',
  api_key_auth_failed: 'Auth échouée',
};

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(date).toLocaleDateString();
}

function fullDate(date: string): string {
  return new Date(date).toLocaleString();
}

export function Logs() {
  const { t } = useTranslation();
  useDocumentTitle(t('logs.title'));
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [page, setPage] = useState(1);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const limit = 20;

  const severityParam = severityFilter !== 'all' ? severityFilter : undefined;
  const actionParam = actionFilter !== 'all' ? actionFilter : undefined;

  const { data, isLoading: loading, isFetching, refetch } = useLogsQuery({
    severity: severityParam,
    action: actionParam,
    page,
    limit,
    refetchInterval: autoRefresh ? 30_000 : undefined,
  });

  const logs: AuditLog[] = data?.data ?? [];
  const total: number = data?.total ?? 0;

  const filteredLogs = logs.filter(log => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.errorMessage || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.sessionName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.apiKeyName || '').toLowerCase().includes(searchQuery.toLowerCase());

    let matchesDate = true;
    if (dateFilter !== 'all') {
      const logDate = new Date(log.createdAt).getTime();
      const now = Date.now();
      const ranges = { today: 86400000, '7d': 7 * 86400000, '30d': 30 * 86400000 };
      matchesDate = logDate >= now - ranges[dateFilter];
    }

    return matchesSearch && matchesDate;
  });

  const errorCount = filteredLogs.filter(l => l.severity === 'error').length;
  const warnCount = filteredLogs.filter(l => l.severity === 'warn').length;
  const infoCount = filteredLogs.filter(l => l.severity === 'info').length;

  const totalPages = Math.ceil(total / limit);

  const handleExportCsv = () => {
    const rows = [
      ['Timestamp', 'Action', 'Session', 'API Key', 'IP', 'Severity', 'Error'],
      ...filteredLogs.map(log => [
        fullDate(log.createdAt),
        log.action,
        log.sessionName || log.sessionId || '',
        log.apiKeyName || '',
        log.ipAddress || '',
        log.severity,
        log.errorMessage || '',
      ]),
    ];
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `openwa-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setSeverityFilter('all');
    setActionFilter('all');
    setDateFilter('all');
    setSearchQuery('');
    setPage(1);
  };

  if (loading && logs.length === 0) {
    return (
      <div
        className="logs-page"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}
      >
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="logs-page">
      <PageHeader
        title={t('logs.title')}
        subtitle={t('logs.subtitle')}
        actions={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className={`btn-secondary auto-refresh-btn${autoRefresh ? ' active' : ''}`}
              onClick={() => setAutoRefresh(v => !v)}
              title={autoRefresh ? 'Désactiver le rafraîchissement automatique' : 'Activer (30s)'}
            >
              <RefreshCw size={16} className={isFetching ? 'spin' : ''} />
              {autoRefresh ? 'Auto ON' : 'Auto OFF'}
            </button>
            <button className="btn-secondary" onClick={() => void refetch()} title="Rafraîchir maintenant">
              <RefreshCw size={16} />
            </button>
            <button className="btn-secondary" onClick={handleExportCsv}>
              <Download size={18} />
              {t('logs.exportCsv')}
            </button>
          </div>
        }
      />

      {/* Stats bar */}
      {filteredLogs.length > 0 && (
        <div className="logs-stats-bar">
          <div className="logs-stat-chip logs-stat-total">
            <FileText size={13} />
            <span>{filteredLogs.length} entrées</span>
          </div>
          {errorCount > 0 && (
            <button
              className="logs-stat-chip logs-stat-error"
              onClick={() => { setSeverityFilter('error'); setPage(1); }}
            >
              <AlertCircle size={13} />
              <span>{errorCount} erreur{errorCount > 1 ? 's' : ''}</span>
            </button>
          )}
          {warnCount > 0 && (
            <button
              className="logs-stat-chip logs-stat-warn"
              onClick={() => { setSeverityFilter('warn'); setPage(1); }}
            >
              <AlertTriangle size={13} />
              <span>{warnCount} avert.</span>
            </button>
          )}
          {infoCount > 0 && (
            <div className="logs-stat-chip logs-stat-info">
              <Info size={13} />
              <span>{infoCount} info</span>
            </div>
          )}
          {(severityFilter !== 'all' || actionFilter !== 'all' || dateFilter !== 'all' || searchQuery) && (
            <button className="logs-stat-chip logs-stat-reset" onClick={resetFilters}>
              × Effacer filtres
            </button>
          )}
        </div>
      )}

      <div className="filters-bar">
        <div className="search-input">
          <Search size={18} />
          <input
            type="text"
            placeholder={t('logs.searchPlaceholder')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <Filter size={16} />
          <select
            value={severityFilter}
            onChange={e => { setSeverityFilter(e.target.value); setPage(1); }}
          >
            <option value="all">{t('logs.severity.all')}</option>
            <option value="info">{t('logs.severity.info')}</option>
            <option value="warn">{t('logs.severity.warn')}</option>
            <option value="error">{t('logs.severity.error')}</option>
          </select>
        </div>

        <div className="filter-group">
          <select
            value={actionFilter}
            onChange={e => { setActionFilter(e.target.value); setPage(1); }}
          >
            <option value="all">Toutes actions</option>
            {ACTION_GROUPS.map(group => (
              <optgroup key={group.label} label={group.label}>
                {group.actions.map(a => (
                  <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <select
            value={dateFilter}
            onChange={e => { setDateFilter(e.target.value as typeof dateFilter); setPage(1); }}
          >
            <option value="all">Tout</option>
            <option value="today">Aujourd'hui</option>
            <option value="7d">7 derniers jours</option>
            <option value="30d">30 derniers jours</option>
          </select>
        </div>
      </div>

      <div className="logs-table-container">
        <div className="logs-table">
          <div className="table-row header">
            <span>{t('logs.columns.timestamp')}</span>
            <span>{t('logs.columns.action')}</span>
            <span>{t('logs.columns.session')}</span>
            <span>{t('logs.columns.apiKey')}</span>
            <span>{t('logs.columns.ip')}</span>
            <span>{t('logs.columns.severity')}</span>
          </div>
          {filteredLogs.length === 0 ? (
            <div className="empty-table-state">
              <FileText size={48} strokeWidth={1} />
              <h3>{t('logs.empty.title')}</h3>
              <p>{t('logs.empty.description')}</p>
            </div>
          ) : (
            filteredLogs.map(log => (
              <div key={log.id}>
                <div
                  className={`table-row log-row-clickable${expandedLog === log.id ? ' expanded' : ''}`}
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                >
                  <span className="timestamp" title={fullDate(log.createdAt)}>
                    {timeAgo(log.createdAt)}
                  </span>
                  <span className="action">{ACTION_LABELS[log.action] ?? log.action}</span>
                  <span>{log.sessionName || log.sessionId || '—'}</span>
                  <span className="api-key">{log.apiKeyName || '—'}</span>
                  <span className="ip">{log.ipAddress || '—'}</span>
                  <span>
                    <span className={`severity-badge ${log.severity}`}>{log.severity.toUpperCase()}</span>
                  </span>
                </div>
                {expandedLog === log.id && (
                  <div className="log-row-expanded">
                    <div className="expanded-item">
                      <span className="expanded-label">Horodatage</span>
                      <span className="expanded-value">{fullDate(log.createdAt)}</span>
                    </div>
                    <div className="expanded-item">
                      <span className="expanded-label">Action</span>
                      <span className="expanded-value mono">{log.action}</span>
                    </div>
                    {(log.method || log.path || log.statusCode != null) && (
                      <div className="expanded-item">
                        <span className="expanded-label">Requête</span>
                        <span className="expanded-value">
                          {[log.method, log.path, log.statusCode != null ? `(${log.statusCode})` : '']
                            .filter(Boolean)
                            .join(' ')}
                        </span>
                      </div>
                    )}
                    {log.errorMessage && (
                      <div className="expanded-item">
                        <span className="expanded-label">Erreur</span>
                        <span className="expanded-value expanded-error">{log.errorMessage}</span>
                      </div>
                    )}
                    {log.apiKeyId && (
                      <div className="expanded-item">
                        <span className="expanded-label">ID clé API</span>
                        <span className="expanded-value mono">{log.apiKeyId}</span>
                      </div>
                    )}
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="expanded-item expanded-item--full">
                        <span className="expanded-label">Metadata</span>
                        <pre className="expanded-metadata">{JSON.stringify(log.metadata, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            {t('common.previous')}
          </button>
          <span className="page-numbers">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
              <button key={p} className={p === page ? 'active' : ''} onClick={() => setPage(p)}>
                {p}
              </button>
            ))}
          </span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            {t('common.next')}
          </button>
        </div>
      )}
    </div>
  );
}
