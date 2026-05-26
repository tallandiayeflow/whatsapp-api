import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Loader2, X, Radio } from 'lucide-react';
import { sessionApi, channelApi, type Channel, type Session } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToast } from '../components/Toast';
import { PageHeader } from '../components/PageHeader';
import { useRole } from '../hooks/useRole';

export function Channels() {
  const { t } = useTranslation();
  useDocumentTitle(t('channels.title', 'Channels'));
  const toast = useToast();
  const { canWrite } = useRole();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [subscribing, setSubscribing] = useState(false);
  const [unsubscribeTarget, setUnsubscribeTarget] = useState<Channel | null>(null);

  useEffect(() => {
    sessionApi.list().then(list => {
      setSessions(list);
      const ready = list.find(s => s.status === 'ready');
      if (ready) setSelectedSession(ready.id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedSession) return;
    setLoading(true);
    channelApi.list(selectedSession)
      .then(setChannels)
      .catch(() => toast.error(t('channels.errorLoad', 'Erreur'), t('channels.errorLoadDesc', 'Impossible de charger les channels')))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSession]);

  const handleSubscribe = async () => {
    if (!inviteCode.trim() || !selectedSession) return;
    setSubscribing(true);
    try {
      await channelApi.subscribe(selectedSession, inviteCode.trim());
      toast.success(t('channels.subscribeSuccess', 'Abonné'), t('channels.subscribeSuccessDesc', 'Abonnement réussi'));
      setInviteCode('');
      setShowSubscribeModal(false);
      // Refresh list
      const updated = await channelApi.list(selectedSession);
      setChannels(updated);
    } catch (err) {
      toast.error(t('channels.subscribeError', 'Erreur'), err instanceof Error ? err.message : t('common.unknownError'));
    } finally {
      setSubscribing(false);
    }
  };

  const handleUnsubscribe = async (channel: Channel) => {
    try {
      await channelApi.unsubscribe(selectedSession, channel.id);
      setChannels(prev => prev.filter(c => c.id !== channel.id));
      toast.success(t('channels.unsubscribeSuccess', 'Désabonné'), t('channels.unsubscribeSuccessDesc', 'Désabonnement réussi'));
    } catch (err) {
      toast.error(t('channels.unsubscribeError', 'Erreur'), err instanceof Error ? err.message : t('common.unknownError'));
    } finally {
      setUnsubscribeTarget(null);
    }
  };

  const readySessions = sessions.filter(s => s.status === 'ready');

  return (
    <div className="page-content">
      <PageHeader
        title={t('channels.title', 'Channels WhatsApp')}
        subtitle={t('channels.subtitle', 'Gérez vos abonnements aux newsletters et channels WhatsApp')}
        actions={
          canWrite ? (
            <button
              className="btn-primary"
              onClick={() => setShowSubscribeModal(true)}
              disabled={!selectedSession}
            >
              <Plus size={16} />
              {t('channels.subscribe', 'S\'abonner')}
            </button>
          ) : null
        }
      />

      {/* Session selector */}
      <div className="filter-bar" style={{ marginBottom: '1.5rem' }}>
        <label style={{ fontWeight: 500, marginRight: '0.5rem' }}>
          {t('channels.session', 'Session')} :
        </label>
        <select
          value={selectedSession}
          onChange={e => setSelectedSession(e.target.value)}
          className="select-input"
          style={{ minWidth: '200px' }}
        >
          {readySessions.length === 0 && (
            <option value="">{t('channels.noReadySession', 'Aucune session active')}</option>
          )}
          {readySessions.map(s => (
            <option key={s.id} value={s.id}>{s.name} ({s.phone || s.id.slice(0, 8)})</option>
          ))}
        </select>
      </div>

      {/* Channels list */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Loader2 className="animate-spin" size={32} />
        </div>
      ) : channels.length === 0 ? (
        <div className="empty-state">
          <Radio size={48} style={{ color: '#94a3b8', marginBottom: '1rem' }} />
          <h3>{t('channels.empty', 'Aucun channel')}</h3>
          <p>{t('channels.emptyDesc', 'Abonnez-vous à un channel WhatsApp en utilisant un code d\'invitation')}</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('channels.name', 'Nom')}</th>
                <th>{t('channels.description', 'Description')}</th>
                <th>{t('channels.subscribers', 'Abonnés')}</th>
                <th>{t('channels.verified', 'Vérifié')}</th>
                {canWrite && <th>{t('common.actions', 'Actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {channels.map(channel => (
                <tr key={channel.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {channel.pictureUrl ? (
                        <img src={channel.pictureUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Radio size={16} style={{ color: '#64748b' }} />
                        </div>
                      )}
                      <span className="font-medium">{channel.name}</span>
                    </div>
                  </td>
                  <td style={{ color: '#64748b', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {channel.description || '—'}
                  </td>
                  <td>{channel.subscriberCount?.toLocaleString() ?? '—'}</td>
                  <td>
                    {channel.verified ? (
                      <span className="status-badge ready">✓ Vérifié</span>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>—</span>
                    )}
                  </td>
                  {canWrite && (
                    <td>
                      <button
                        className="btn-icon btn-danger"
                        onClick={() => setUnsubscribeTarget(channel)}
                        title={t('channels.unsubscribe', 'Se désabonner')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Subscribe modal */}
      {showSubscribeModal && (
        <div className="modal-overlay" onClick={() => setShowSubscribeModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('channels.subscribeTitle', 'S\'abonner à un channel')}</h2>
              <button className="btn-close" onClick={() => setShowSubscribeModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#64748b', marginBottom: '1rem' }}>
                {t('channels.subscribeHint', 'Entrez le code d\'invitation du channel WhatsApp (ex: depuis un lien whatsapp.com/channel/...)')}
              </p>
              <div className="form-group">
                <label>{t('channels.inviteCode', 'Code d\'invitation')}</label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)}
                  placeholder="ABC123xyz..."
                  className="input"
                  onKeyDown={e => e.key === 'Enter' && handleSubscribe()}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowSubscribeModal(false)}>
                {t('common.cancel', 'Annuler')}
              </button>
              <button className="btn-primary" onClick={handleSubscribe} disabled={subscribing || !inviteCode.trim()}>
                {subscribing ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {t('channels.subscribe', 'S\'abonner')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm unsubscribe modal */}
      {unsubscribeTarget && (
        <div className="modal-overlay" onClick={() => setUnsubscribeTarget(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('channels.confirmUnsubscribe', 'Confirmer le désabonnement')}</h2>
            </div>
            <div className="modal-body">
              <p>{t('channels.confirmUnsubscribeDesc', `Se désabonner de "${unsubscribeTarget.name}" ?`)}</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setUnsubscribeTarget(null)}>
                {t('common.cancel', 'Annuler')}
              </button>
              <button className="btn-danger" onClick={() => handleUnsubscribe(unsubscribeTarget)}>
                <Trash2 size={16} />
                {t('channels.unsubscribe', 'Se désabonner')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
