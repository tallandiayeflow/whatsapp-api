import { useState, useEffect, useMemo, useCallback } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { Trans, useTranslation } from 'react-i18next';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type VisibilityState,
} from '@tanstack/react-table';
import { Plus, Copy, RefreshCw, Trash2, Eye, EyeOff, Loader2, X, Check, KeyRound, AlertTriangle, Link, Clock } from 'lucide-react';
import type { ApiKey } from '../services/api';
import { sessionApi, apiKeyApi } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useApiKeysQuery, useCreateApiKeyMutation, useDeleteApiKeyMutation, useRevokeApiKeyMutation } from '../hooks/queries';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../components/Toast';
import { PageHeader } from '../components/PageHeader';
import './ApiKeys.css';

const roleNames = ['admin', 'operator', 'viewer'] as const;

function useWindowSize() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return width;
}

const columnHelper = createColumnHelper<ApiKey>();

export function ApiKeys() {
  const { t } = useTranslation();
  useDocumentTitle(t('apiKeys.title'));
  const toast = useToast();
  const { data: apiKeys = [], isLoading: loading } = useApiKeysQuery();
  const createMutation = useCreateApiKeyMutation();
  const deleteMutation = useDeleteApiKeyMutation();
  const revokeMutation = useRevokeApiKeyMutation();
  const queryClient = useQueryClient();
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [newKey, setNewKey] = useState({ name: '', role: 'operator', defaultSessionId: '', expiresAt: '' });
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [sessions, setSessions] = useState<{ id: string; name: string; status: string }[]>([]);
  const [linkTarget, setLinkTarget] = useState<{ key: ApiKey; sessionId: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'delete' | 'revoke'; id: string; name: string } | null>(
    null,
  );

  const windowWidth = useWindowSize();
  const isMobile = windowWidth < 768;
  const isSmall = windowWidth < 640;
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  useEffect(() => {
    setColumnVisibility({ key: !isSmall, lastUsed: !isMobile, expiry: !isSmall });
  }, [isMobile, isSmall]);

  useEffect(() => {
    sessionApi.list().then(setSessions).catch(() => {});
  }, []);

  const closeAllModals = useCallback(() => {
    setShowModal(false);
    setConfirmAction(null);
    setLinkTarget(null);
  }, []);
  useEscapeKey(closeAllModals, !!(showModal || confirmAction || linkTarget));

  const addDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const addYears = (years: number) => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + years);
    return d.toISOString().split('T')[0];
  };

  const getExpiryStatus = (expiresAt?: string) => {
    if (!expiresAt) return null;
    const exp = new Date(expiresAt);
    const now = new Date();
    const diffMs = exp.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffMs < 0) return { label: 'Expirée', type: 'expired' as const };
    if (diffDays <= 7) return { label: `${diffDays}j restants`, type: 'warning' as const };
    return { label: `${diffDays}j restants`, type: 'ok' as const };
  };

  const handleCreate = async () => {
    if (!newKey.name) return;
    try {
      const created = await createMutation.mutateAsync({
        name: newKey.name,
        role: newKey.role,
        ...(newKey.defaultSessionId ? { defaultSessionId: newKey.defaultSessionId } : {}),
        ...(newKey.expiresAt ? { expiresAt: new Date(newKey.expiresAt).toISOString() } : {}),
      });
      setCreatedKey(created.apiKey || null);
      setNewKey({ name: '', role: 'operator', defaultSessionId: '', expiresAt: '' });
    } catch (err) {
      toast.error('Erreur', err instanceof Error ? err.message : 'Impossible de créer la clé');
    }
  };

  const handleLinkSession = async () => {
    if (!linkTarget) return;
    try {
      await apiKeyApi.update(linkTarget.key.id, {
        defaultSessionId: linkTarget.sessionId || null,
      });
      void queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      setLinkTarget(null);
    } catch (err) {
      toast.error('Erreur', err instanceof Error ? err.message : 'Impossible de lier la session');
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await revokeMutation.mutateAsync(id);
    } catch (err) {
      toast.error('Erreur', err instanceof Error ? err.message : 'Impossible de révoquer la clé');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
    } catch (err) {
      toast.error('Erreur', err instanceof Error ? err.message : 'Impossible de supprimer la clé');
    }
  };

  const confirmAndExecute = () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'delete') handleDelete(confirmAction.id);
    else handleRevoke(confirmAction.id);
    setConfirmAction(null);
  };

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => t('apiKeys.columns.name'),
        cell: info => <span className="name-cell">{info.getValue()}</span>,
      }),
      columnHelper.accessor('keyPrefix', {
        id: 'key',
        header: () => t('apiKeys.columns.key'),
        cell: info => {
          const apiKey = info.row.original;
          return (
            <span className="key-cell">
              <code>{visibleKeys.has(apiKey.id) ? apiKey.keyPrefix + '...' : apiKey.keyPrefix + '****'}</code>
              <button className="icon-btn-sm" onClick={() => toggleKeyVisibility(apiKey.id)}>
                {visibleKeys.has(apiKey.id) ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </span>
          );
        },
      }),
      columnHelper.accessor('role', {
        header: () => t('apiKeys.columns.role'),
        cell: info => <span className="permission-badge">{info.getValue()}</span>,
      }),
      columnHelper.accessor('isActive', {
        header: () => t('apiKeys.columns.status'),
        cell: info => (
          <span className={`status-badge ${info.getValue() ? 'active' : 'inactive'}`}>
            {info.getValue() ? t('apiKeys.statuses.active') : t('apiKeys.statuses.revoked')}
          </span>
        ),
      }),
      columnHelper.accessor('lastUsedAt', {
        id: 'lastUsed',
        header: () => t('apiKeys.columns.lastUsed'),
        cell: info => (
          <span className="last-used">
            {info.getValue() ? new Date(info.getValue()!).toLocaleDateString() : t('common.never')}
          </span>
        ),
      }),
      columnHelper.accessor('expiresAt', {
        id: 'expiry',
        header: () => 'Expiration',
        cell: info => {
          const val = info.getValue();
          if (!val) return <span className="expiry-badge expiry-none">Jamais</span>;
          const status = getExpiryStatus(val);
          if (!status) return null;
          return (
            <span className={`expiry-badge expiry-${status.type}`} title={new Date(val).toLocaleDateString()}>
              <Clock size={11} />
              {status.label}
            </span>
          );
        },
      }),
      columnHelper.accessor('defaultSessionId', {
        id: 'session',
        header: () => 'Session liée',
        cell: info => {
          const apiKey = info.row.original;
          const linked = sessions.find(s => s.id === apiKey.defaultSessionId);
          return (
            <span
              className="session-link-cell"
              title="Cliquer pour lier une session"
              style={{ cursor: 'pointer' }}
              onClick={() => setLinkTarget({ key: apiKey, sessionId: apiKey.defaultSessionId ?? '' })}
            >
              {linked ? (
                <span className="session-badge ready">{linked.name}</span>
              ) : (
                <span className="session-badge none">— lier</span>
              )}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: () => t('apiKeys.columns.actions'),
        cell: info => {
          const apiKey = info.row.original;
          return (
            <span className="actions-cell">
              <button
                className="icon-btn"
                onClick={() => copyToClipboard(apiKey.keyPrefix, apiKey.id)}
                title="Copier le préfixe"
                aria-label="Copier le préfixe de la clé"
              >
                {copied === apiKey.id ? <Check size={16} /> : <Copy size={16} />}
              </button>
              <button
                className="icon-btn"
                onClick={() => setLinkTarget({ key: apiKey, sessionId: apiKey.defaultSessionId ?? '' })}
                title="Lier une session"
                aria-label="Lier une session WhatsApp"
              >
                <Link size={16} />
              </button>
              {apiKey.isActive && (
                <button
                  className="icon-btn"
                  onClick={() => setConfirmAction({ type: 'revoke', id: apiKey.id, name: apiKey.name })}
                  title={t('apiKeys.actions.revoke')}
                  aria-label={`${t('apiKeys.actions.revoke')} ${apiKey.name}`}
                >
                  <RefreshCw size={16} />
                </button>
              )}
              <button
                className="icon-btn danger"
                onClick={() => setConfirmAction({ type: 'delete', id: apiKey.id, name: apiKey.name })}
                title={t('apiKeys.actions.delete')}
                aria-label={`${t('apiKeys.actions.delete')} ${apiKey.name}`}
              >
                <Trash2 size={16} />
              </button>
            </span>
          );
        },
      }),
    ],
    [visibleKeys, copied, t, sessions],
  );

  const table = useReactTable({
    data: apiKeys,
    columns,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
  });

  if (loading) {
    return (
      <div
        className="api-keys-page"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}
      >
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="api-keys-page">
      <PageHeader
        title={t('apiKeys.title')}
        subtitle={t('apiKeys.subtitle')}
        actions={
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} />
            {t('apiKeys.createBtn')}
          </button>
        }
      />

      {showModal && (
        <div
          className="modal-overlay" aria-hidden="true"
          onClick={() => {
            setShowModal(false);
            setCreatedKey(null);
          }}
        >
          <div role="dialog" aria-modal="true" className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{createdKey ? t('apiKeys.createdTitle') : t('apiKeys.modalTitle')}</h2>
              <button
                className="btn-icon"
                onClick={() => {
                  setShowModal(false);
                  setCreatedKey(null);
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              {createdKey ? (
                <div>
                  <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>{t('apiKeys.createdHint')}</p>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <code
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        background: 'var(--bg-secondary)',
                        borderRadius: '6px',
                        wordBreak: 'break-all',
                      }}
                    >
                      {createdKey}
                    </code>
                    <button className="btn-primary" onClick={() => copyToClipboard(createdKey, 'modal')}>
                      {copied === 'modal' ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <label>{t('common.name')}</label>
                  <input
                    type="text"
                    placeholder={t('apiKeys.namePlaceholder')}
                    value={newKey.name}
                    onChange={e => setNewKey({ ...newKey, name: e.target.value })}
                  />
                  <label>{t('common.role')}</label>
                  <select value={newKey.role} onChange={e => setNewKey({ ...newKey, role: e.target.value })}>
                    {roleNames.map(r => (
                      <option key={r} value={r}>
                        {t(`apiKeys.roles.${r}`)}
                      </option>
                    ))}
                  </select>
                  <label style={{ marginTop: '0.75rem' }}>Session WhatsApp liée <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optionnel)</span></label>
                  <select
                    value={newKey.defaultSessionId}
                    onChange={e => setNewKey({ ...newKey, defaultSessionId: e.target.value })}
                  >
                    <option value="">— Auto-sélection</option>
                    {sessions.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.status})
                      </option>
                    ))}
                  </select>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                    Sans session liée : la clé utilisera automatiquement la seule session active.
                  </p>
                  <label style={{ marginTop: '0.75rem' }}>
                    Expiration{' '}
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optionnel)</span>
                  </label>
                  <div className="expiry-presets">
                    {[
                      { label: '30 jours', fn: () => addDays(30) },
                      { label: '90 jours', fn: () => addDays(90) },
                      { label: '1 an', fn: () => addYears(1) },
                    ].map(p => (
                      <button
                        key={p.label}
                        type="button"
                        className={`expiry-preset-btn${newKey.expiresAt === p.fn() ? ' active' : ''}`}
                        onClick={() => setNewKey({ ...newKey, expiresAt: p.fn() })}
                      >
                        {p.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`expiry-preset-btn${newKey.expiresAt === '' ? ' active' : ''}`}
                      onClick={() => setNewKey({ ...newKey, expiresAt: '' })}
                    >
                      Jamais
                    </button>
                  </div>
                  <input
                    type="date"
                    value={newKey.expiresAt}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setNewKey({ ...newKey, expiresAt: e.target.value })}
                    style={{ marginTop: '0.5rem' }}
                  />
                </>
              )}
            </div>
            {!createdKey && (
              <div className="modal-footer">
                <button className="btn-secondary" onClick={() => setShowModal(false)}>
                  {t('common.cancel')}
                </button>
                <button className="btn-primary" onClick={handleCreate}>
                  {t('common.create')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="api-keys-content">
        {apiKeys.length > 0 && (
          <div className="api-keys-notice">
            <AlertTriangle size={14} />
            Full API keys are only shown once at creation — they cannot be recovered. The copy button copies the key prefix only.
          </div>
        )}
        <div className="keys-table-container">
          {apiKeys.length === 0 ? (
            <div className="empty-table-state">
              <KeyRound size={48} strokeWidth={1} />
              <h3>{t('apiKeys.empty.title')}</h3>
              <p>{t('apiKeys.empty.description')}</p>
            </div>
          ) : (
            <table className="keys-table">
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id} className="table-row header">
                    {headerGroup.headers.map(header => (
                      <th key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="table-row">
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="permissions-reference">
          <h3>{t('apiKeys.rolesTitle')}</h3>
          <div className="permissions-list">
            {roleNames.map(r => (
              <div key={r} className="perm-item">
                <code>{r}</code>
                <span>{t(`apiKeys.roleDescriptions.${r}`)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {confirmAction && (
        <div className="modal-overlay" aria-hidden="true" onClick={() => setConfirmAction(null)}>
          <div role="dialog" aria-modal="true" className="modal confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {confirmAction.type === 'delete'
                  ? t('apiKeys.confirm.deleteTitle')
                  : t('apiKeys.confirm.revokeTitle')}
              </h2>
              <button className="btn-icon" onClick={() => setConfirmAction(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="confirm-icon-wrapper">
                <AlertTriangle size={48} className="confirm-warning-icon" />
              </div>
              <p className="confirm-message">
                <Trans
                  i18nKey={
                    confirmAction.type === 'delete'
                      ? 'apiKeys.confirm.deleteMessage'
                      : 'apiKeys.confirm.revokeMessage'
                  }
                  values={{ name: confirmAction.name }}
                  components={{ strong: <strong /> }}
                />
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmAction(null)}>
                {t('common.cancel')}
              </button>
              <button className="btn-danger" onClick={confirmAndExecute}>
                {confirmAction.type === 'delete'
                  ? t('apiKeys.confirm.delete')
                  : t('apiKeys.confirm.revoke')}
              </button>
            </div>
          </div>
        </div>
      )}

      {linkTarget && (
        <div className="modal-overlay" aria-hidden="true" onClick={() => setLinkTarget(null)}>
          <div role="dialog" aria-modal="true" className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Lier une session WhatsApp</h2>
              <button className="btn-icon" onClick={() => setLinkTarget(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                Clé : <strong>{linkTarget.key.name}</strong>
              </p>
              <label>Session WhatsApp</label>
              <select
                value={linkTarget.sessionId}
                onChange={e => setLinkTarget({ ...linkTarget, sessionId: e.target.value })}
              >
                <option value="">— Aucune (auto-sélection)</option>
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.status})
                  </option>
                ))}
              </select>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Une fois liée, cette clé peut envoyer des messages via{' '}
                <code>POST /api/messages/send-text</code> sans préciser de sessionId.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setLinkTarget(null)}>
                Annuler
              </button>
              <button className="btn-primary" onClick={() => void handleLinkSession()}>
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
