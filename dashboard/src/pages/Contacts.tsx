import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Search, User, Phone, ShieldOff, Shield, CheckCircle, XCircle,
  Loader2, Users, AlertCircle,
} from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/Toast';
import { sessionApi, contactApi } from '../services/api';
import type { Contact, NumberCheckResult } from '../services/api';
import './Contacts.css';

export function Contacts() {
  const { t } = useTranslation();
  useDocumentTitle(t('contacts.title', { defaultValue: 'Contacts' }));
  const toast = useToast();

  const [selectedSession, setSelectedSession] = useState('');
  const [search, setSearch] = useState('');
  const [checkNumber, setCheckNumber] = useState('');
  const [checkResult, setCheckResult] = useState<NumberCheckResult | null>(null);
  const [checkLoading, setCheckLoading] = useState(false);

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions'],
    queryFn: sessionApi.list,
    staleTime: 30_000,
  });
  const readySessions = sessions.filter(s => s.status === 'ready');

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts', selectedSession],
    queryFn: () => contactApi.list(selectedSession),
    enabled: !!selectedSession,
    staleTime: 60_000,
  });

  const blockMutation = useMutation({
    mutationFn: ({ contactId, blocked }: { contactId: string; blocked: boolean }) =>
      blocked ? contactApi.unblock(selectedSession, contactId) : contactApi.block(selectedSession, contactId),
    onSuccess: (_, { blocked }) => {
      toast.success(
        blocked
          ? t('contacts.unblocked', { defaultValue: 'Unblocked' })
          : t('contacts.blocked', { defaultValue: 'Blocked' }),
        blocked
          ? t('contacts.unblockedDesc', { defaultValue: 'Contact unblocked successfully' })
          : t('contacts.blockedDesc', { defaultValue: 'Contact blocked successfully' }),
      );
    },
    onError: (err) => {
      toast.error(t('common.errorGeneric'), err instanceof Error ? err.message : t('common.unknownError'));
    },
  });

  const handleCheckNumber = async () => {
    if (!selectedSession || !checkNumber.trim()) return;
    setCheckLoading(true);
    setCheckResult(null);
    try {
      const result = await contactApi.check(selectedSession, checkNumber.trim().replace(/\D/g, ''));
      setCheckResult(result);
    } catch (err) {
      toast.error(
        t('contacts.checkError', { defaultValue: 'Check Failed' }),
        err instanceof Error ? err.message : t('common.unknownError'),
      );
    } finally {
      setCheckLoading(false);
    }
  };

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase();
    return (
      (c.name ?? '').toLowerCase().includes(q) ||
      (c.pushName ?? '').toLowerCase().includes(q) ||
      c.number.includes(q)
    );
  });

  const displayName = (c: Contact) => c.name || c.pushName || c.number;

  const initials = (c: Contact) => {
    const n = displayName(c);
    return n.slice(0, 2).toUpperCase();
  };

  return (
    <div className="contacts-page">
      <PageHeader
        title={t('contacts.title', { defaultValue: 'Contacts' })}
        subtitle={t('contacts.subtitle', { defaultValue: 'Browse and manage your WhatsApp contacts' })}
      />

      {/* Session selector */}
      <div className="contacts-session-bar">
        <label className="session-bar-label">
          <Users size={16} />
          {t('contacts.session', { defaultValue: 'Session' })}
        </label>
        <select
          value={selectedSession}
          onChange={e => { setSelectedSession(e.target.value); setCheckResult(null); }}
          className="session-bar-select"
        >
          <option value="">{t('contacts.selectSession', { defaultValue: 'Select a session...' })}</option>
          {readySessions.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        {readySessions.length === 0 && (
          <span className="session-bar-hint">
            <AlertCircle size={14} />
            {t('contacts.noReadySession', { defaultValue: 'No active session available' })}
          </span>
        )}
      </div>

      {selectedSession && (
        <>
          {/* Number checker */}
          <div className="number-checker-card">
            <h3 className="checker-title">
              <Phone size={18} />
              {t('contacts.checkTitle', { defaultValue: 'Check a Number' })}
            </h3>
            <p className="checker-subtitle">
              {t('contacts.checkHint', { defaultValue: 'Verify if a phone number is registered on WhatsApp' })}
            </p>
            <div className="checker-row">
              <input
                className="checker-input"
                type="tel"
                placeholder={t('contacts.checkPlaceholder', { defaultValue: 'e.g. 221771234567 (international format)' })}
                value={checkNumber}
                onChange={e => { setCheckNumber(e.target.value); setCheckResult(null); }}
                onKeyDown={e => e.key === 'Enter' && handleCheckNumber()}
              />
              <button
                className="btn-primary checker-btn"
                onClick={handleCheckNumber}
                disabled={!checkNumber.trim() || checkLoading}
              >
                {checkLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                {t('contacts.check', { defaultValue: 'Check' })}
              </button>
            </div>
            {checkResult && (
              <div className={`checker-result ${checkResult.exists ? 'checker-result--found' : 'checker-result--notfound'}`}>
                {checkResult.exists ? (
                  <>
                    <CheckCircle size={18} />
                    <span>
                      <strong>{t('contacts.numberFound', { defaultValue: 'Registered on WhatsApp' })}</strong>
                      {' — '}{checkResult.whatsappId}
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle size={18} />
                    <span>{t('contacts.numberNotFound', { defaultValue: 'Not registered on WhatsApp' })}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Search */}
          <div className="contacts-toolbar">
            <div className="search-input">
              <Search size={16} />
              <input
                type="text"
                placeholder={t('contacts.searchPlaceholder', { defaultValue: 'Search contacts...' })}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <span className="contacts-count">
              {isLoading ? '…' : t('contacts.count', { defaultValue: '{{count}} contacts', count: filtered.length })}
            </span>
          </div>

          {/* Contacts list */}
          <div className="contacts-table-container">
            {isLoading ? (
              <div className="contacts-loading">
                <Loader2 size={28} className="animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="contacts-empty">
                <User size={48} strokeWidth={1} />
                <h3>{search ? t('contacts.emptySearch', { defaultValue: 'No contacts match your search' }) : t('contacts.empty', { defaultValue: 'No contacts found' })}</h3>
                <p>{search ? '' : t('contacts.emptyDesc', { defaultValue: 'Contacts will appear once the session is connected' })}</p>
              </div>
            ) : (
              <table className="contacts-table">
                <thead>
                  <tr>
                    <th>{t('common.name')}</th>
                    <th>{t('contacts.number', { defaultValue: 'Number' })}</th>
                    <th>{t('common.status')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(contact => (
                    <tr key={contact.id} className={contact.isBlocked ? 'row-blocked' : ''}>
                      <td>
                        <div className="contact-name-cell">
                          <div className="contact-avatar">
                            {contact.profilePicUrl
                              ? <img src={contact.profilePicUrl} alt={displayName(contact)} />
                              : <span>{initials(contact)}</span>}
                          </div>
                          <div className="contact-name-info">
                            <span className="contact-display-name">{displayName(contact)}</span>
                            {contact.name && contact.pushName && contact.name !== contact.pushName && (
                              <span className="contact-push-name">{contact.pushName}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="contact-number">{contact.number}</td>
                      <td>
                        {contact.isBlocked ? (
                          <span className="status-chip status-chip--blocked">
                            <ShieldOff size={12} />
                            {t('contacts.statusBlocked', { defaultValue: 'Blocked' })}
                          </span>
                        ) : contact.isMyContact ? (
                          <span className="status-chip status-chip--contact">
                            <User size={12} />
                            {t('contacts.statusSaved', { defaultValue: 'Saved' })}
                          </span>
                        ) : (
                          <span className="status-chip status-chip--unknown">
                            {t('contacts.statusUnsaved', { defaultValue: 'Unsaved' })}
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          className={`btn-action-sm ${contact.isBlocked ? 'btn-action-sm--unblock' : 'btn-action-sm--block'}`}
                          onClick={() => blockMutation.mutate({ contactId: contact.id, blocked: contact.isBlocked })}
                          disabled={blockMutation.isPending}
                          title={contact.isBlocked ? t('contacts.unblock', { defaultValue: 'Unblock' }) : t('contacts.block', { defaultValue: 'Block' })}
                        >
                          {contact.isBlocked ? <Shield size={14} /> : <ShieldOff size={14} />}
                          {contact.isBlocked
                            ? t('contacts.unblock', { defaultValue: 'Unblock' })
                            : t('contacts.block', { defaultValue: 'Block' })}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {!selectedSession && (
        <div className="contacts-placeholder">
          <Users size={64} strokeWidth={1} className="placeholder-icon" />
          <h3>{t('contacts.selectSessionTitle', { defaultValue: 'Select a Session' })}</h3>
          <p>{t('contacts.selectSessionDesc', { defaultValue: 'Choose an active session to browse contacts' })}</p>
        </div>
      )}
    </div>
  );
}
