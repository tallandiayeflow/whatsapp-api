import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Search, Filter, Loader2, FileText } from 'lucide-react';
import type { AuditLog } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLogsQuery } from '../hooks/queries';
import { PageHeader } from '../components/PageHeader';
import './Logs.css';

export function Logs() {
  const { t } = useTranslation();
  useDocumentTitle(t('logs.title'));
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [page, setPage] = useState(1);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const limit = 20;

  const severityParam = severityFilter !== 'all' ? severityFilter : undefined;
  const { data, isLoading: loading } = useLogsQuery({ severity: severityParam, page, limit });
  const logs: AuditLog[] = data?.data ?? [];
  const total: number = data?.total ?? 0;

  const filteredLogs = logs.filter(log => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.errorMessage || '').toLowerCase().includes(searchQuery.toLowerCase());

    let matchesDate = true;
    if (dateFilter !== 'all') {
      const logDate = new Date(log.createdAt).getTime();
      const now = Date.now();
      const ranges = { today: 86400000, '7d': 7 * 86400000, '30d': 30 * 86400000 };
      matchesDate = logDate >= now - ranges[dateFilter];
    }

    return matchesSearch && matchesDate;
  });

  const totalPages = Math.ceil(total / limit);

  const formatTimestamp = (date: string) => new Date(date).toLocaleString();

  const handleExportCsv = () => {
    const rows = [
      ['Timestamp', 'Action', 'Session', 'API Key', 'IP', 'Severity', 'Error'],
      ...filteredLogs.map(log => [
        formatTimestamp(log.createdAt),
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
          <button className="btn-secondary" onClick={handleExportCsv}>
            <Download size={18} />
            {t('logs.exportCsv')}
          </button>
        }
      />

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
            onChange={e => {
              setSeverityFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">{t('logs.severity.all')}</option>
            <option value="info">{t('logs.severity.info')}</option>
            <option value="warn">{t('logs.severity.warn')}</option>
            <option value="error">{t('logs.severity.error')}</option>
          </select>
        </div>

        <div className="filter-group">
          <select
            value={dateFilter}
            onChange={e => {
              setDateFilter(e.target.value as 'all' | 'today' | '7d' | '30d');
              setPage(1);
            }}
          >
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
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
                  <span className="timestamp">{formatTimestamp(log.createdAt)}</span>
                  <span className="action">{log.action}</span>
                  <span>{log.sessionName || log.sessionId || '—'}</span>
                  <span className="api-key">{log.apiKeyName || '—'}</span>
                  <span className="ip">{log.ipAddress || '—'}</span>
                  <span>
                    <span className={`severity-badge ${log.severity}`}>{log.severity.toUpperCase()}</span>
                  </span>
                </div>
                {expandedLog === log.id && (
                  <div className="log-row-expanded">
                    {(log.method || log.path || log.statusCode != null) && (
                      <div className="expanded-item">
                        <span className="expanded-label">Request</span>
                        <span className="expanded-value">
                          {[log.method, log.path, log.statusCode != null ? `(${log.statusCode})` : '']
                            .filter(Boolean)
                            .join(' ')}
                        </span>
                      </div>
                    )}
                    {log.errorMessage && (
                      <div className="expanded-item">
                        <span className="expanded-label">Error</span>
                        <span className="expanded-value expanded-error">{log.errorMessage}</span>
                      </div>
                    )}
                    {log.apiKeyId && (
                      <div className="expanded-item">
                        <span className="expanded-label">API Key ID</span>
                        <span className="expanded-value mono">{log.apiKeyId}</span>
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
