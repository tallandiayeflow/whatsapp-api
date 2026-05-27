import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Plus, Trash2, Loader2, Users, AlertCircle, FileText, Image,
  X, Clock,
} from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/Toast';
import { sessionApi, statusApi } from '../services/api';
import type { Status } from '../services/api';
import './Statuses.css';

const FONT_NAMES = ['Sans-Serif', 'Serif', 'Monospace', 'Cursive', 'Display'];

const BG_COLORS = [
  '#25d366', '#128c7e', '#075e54',
  '#1da1f2', '#3b5998', '#e1306c',
  '#ff6b35', '#ffd700', '#2d2d2d',
  '#ffffff',
];

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function expiresIn(ts: string): string {
  const diff = new Date(ts).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m left`;
  return `${h}h left`;
}

export function Statuses() {
  const { t } = useTranslation();
  useDocumentTitle(t('statuses.title', { defaultValue: 'Statuses' }));
  const toast = useToast();
  const queryClient = useQueryClient();

  const [selectedSession, setSelectedSession] = useState('');
  const [showPostModal, setShowPostModal] = useState(false);
  const [postType, setPostType] = useState<'text' | 'image'>('text');
  const [postText, setPostText] = useState('');
  const [postBg, setPostBg] = useState('#25d366');
  const [postFont, setPostFont] = useState(0);
  const [postImageUrl, setPostImageUrl] = useState('');
  const [postCaption, setPostCaption] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions'],
    queryFn: sessionApi.list,
    staleTime: 30_000,
  });
  const readySessions = sessions.filter(s => s.status === 'ready');

  const { data, isLoading } = useQuery({
    queryKey: ['statuses', selectedSession],
    queryFn: () => statusApi.getAll(selectedSession),
    enabled: !!selectedSession,
    staleTime: 30_000,
  });
  const statuses: Status[] = data?.statuses ?? [];

  const postMutation = useMutation({
    mutationFn: () => {
      if (postType === 'image') {
        return statusApi.sendImage(selectedSession, {
          image: { url: postImageUrl },
          caption: postCaption || undefined,
        });
      }
      return statusApi.sendText(selectedSession, {
        text: postText,
        backgroundColor: postBg,
        font: postFont,
      });
    },
    onSuccess: () => {
      toast.success(
        t('statuses.posted', { defaultValue: 'Status Posted' }),
        t('statuses.postedDesc', { defaultValue: 'Your status will be visible for 24 hours' }),
      );
      setShowPostModal(false);
      setPostText(''); setPostImageUrl(''); setPostCaption('');
      queryClient.invalidateQueries({ queryKey: ['statuses', selectedSession] });
    },
    onError: (err) => {
      toast.error(
        t('statuses.postError', { defaultValue: 'Post Failed' }),
        err instanceof Error ? err.message : t('common.unknownError'),
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (statusId: string) => statusApi.delete(selectedSession, statusId),
    onSuccess: () => {
      toast.success(
        t('statuses.deleted', { defaultValue: 'Status Deleted' }),
        t('statuses.deletedDesc', { defaultValue: 'Status removed successfully' }),
      );
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['statuses', selectedSession] });
    },
    onError: (err) => {
      toast.error(t('common.errorGeneric'), err instanceof Error ? err.message : t('common.unknownError'));
    },
  });

  const handlePost = () => {
    if (postType === 'text' && !postText.trim()) return;
    if (postType === 'image' && !postImageUrl.trim()) return;
    postMutation.mutate();
  };

  const resetModal = () => {
    setShowPostModal(false);
    setPostText(''); setPostImageUrl(''); setPostCaption('');
    setPostType('text'); setPostBg('#25d366'); setPostFont(0);
  };

  return (
    <div className="statuses-page">
      <PageHeader
        title={t('statuses.title', { defaultValue: 'Statuses' })}
        subtitle={t('statuses.subtitle', { defaultValue: 'View contacts statuses and post your own' })}
        actions={
          selectedSession ? (
            <button className="btn-primary" onClick={() => setShowPostModal(true)}>
              <Plus size={18} />
              {t('statuses.postBtn', { defaultValue: 'Post Status' })}
            </button>
          ) : undefined
        }
      />

      {/* Session selector */}
      <div className="statuses-session-bar">
        <label className="session-bar-label">
          <Users size={16} />
          {t('statuses.session', { defaultValue: 'Session' })}
        </label>
        <select
          value={selectedSession}
          onChange={e => setSelectedSession(e.target.value)}
          className="session-bar-select"
        >
          <option value="">{t('statuses.selectSession', { defaultValue: 'Select a session...' })}</option>
          {readySessions.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        {readySessions.length === 0 && (
          <span className="session-bar-hint">
            <AlertCircle size={14} />
            {t('statuses.noReadySession', { defaultValue: 'No active session available' })}
          </span>
        )}
      </div>

      {/* Status list */}
      {selectedSession && (
        isLoading ? (
          <div className="statuses-loading">
            <Loader2 size={28} className="animate-spin" />
          </div>
        ) : statuses.length === 0 ? (
          <div className="statuses-empty">
            <FileText size={56} strokeWidth={1} />
            <h3>{t('statuses.empty', { defaultValue: 'No statuses found' })}</h3>
            <p>{t('statuses.emptyDesc', { defaultValue: "Your contacts' statuses will appear here" })}</p>
          </div>
        ) : (
          <div className="statuses-grid">
            {statuses.map(status => (
              <div key={status.id} className="status-card">
                <div className="status-card-header">
                  <div className="status-contact">
                    <div className="status-avatar">
                      {(status.contact.name || status.contact.pushName || '?').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="status-contact-info">
                      <span className="status-contact-name">
                        {status.contact.name || status.contact.pushName || status.contact.id}
                      </span>
                      <span className="status-time">
                        <Clock size={11} />{timeAgo(status.timestamp)}
                      </span>
                    </div>
                  </div>
                  <div className="status-actions">
                    <span className="status-expires">{expiresIn(status.expiresAt)}</span>
                    <button
                      className="btn-icon-sm btn-danger"
                      onClick={() => setDeleteTarget(status.id)}
                      title={t('common.delete')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div
                  className={`status-content status-content--${status.type}`}
                  style={status.type === 'text' && status.backgroundColor
                    ? { background: status.backgroundColor }
                    : undefined}
                >
                  {status.type === 'text' ? (
                    <p
                      className="status-text"
                      style={{ fontFamily: status.font != null ? ['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'][status.font] : undefined }}
                    >
                      {status.caption || '—'}
                    </p>
                  ) : (
                    <div className="status-media">
                      {status.mediaUrl
                        ? <img src={status.mediaUrl} alt="status" />
                        : <Image size={32} />}
                      {status.caption && <p className="status-media-caption">{status.caption}</p>}
                    </div>
                  )}
                </div>

                <div className="status-footer">
                  <span className={`status-type-badge status-type-badge--${status.type}`}>
                    {status.type === 'text' ? <FileText size={11} /> : <Image size={11} />}
                    {status.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {!selectedSession && (
        <div className="statuses-placeholder">
          <FileText size={64} strokeWidth={1} className="placeholder-icon" />
          <h3>{t('statuses.selectSessionTitle', { defaultValue: 'Select a Session' })}</h3>
          <p>{t('statuses.selectSessionDesc', { defaultValue: 'Choose an active session to view statuses' })}</p>
        </div>
      )}

      {/* Post status modal */}
      {showPostModal && (
        <div className="modal-overlay" aria-hidden="true" onClick={resetModal}>
          <div className="modal modal--status" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('statuses.postTitle', { defaultValue: 'Post a Status' })}</h2>
              <button className="btn-icon" onClick={resetModal}><X size={20} /></button>
            </div>
            <div className="modal-body">
              {/* Type tabs */}
              <div className="status-type-tabs">
                <button
                  className={`type-tab ${postType === 'text' ? 'active' : ''}`}
                  onClick={() => setPostType('text')}
                >
                  <FileText size={15} />
                  {t('statuses.typeText', { defaultValue: 'Text' })}
                </button>
                <button
                  className={`type-tab ${postType === 'image' ? 'active' : ''}`}
                  onClick={() => setPostType('image')}
                >
                  <Image size={15} />
                  {t('statuses.typeImage', { defaultValue: 'Image' })}
                </button>
              </div>

              {postType === 'text' ? (
                <>
                  <label>{t('statuses.textContent', { defaultValue: 'Text' })}</label>
                  <textarea
                    className="status-textarea"
                    placeholder={t('statuses.textPlaceholder', { defaultValue: "What's on your mind?" })}
                    value={postText}
                    onChange={e => setPostText(e.target.value)}
                    maxLength={700}
                    rows={4}
                  />
                  <div className="textarea-count">{postText.length}/700</div>

                  <label>{t('statuses.bgColor', { defaultValue: 'Background Color' })}</label>
                  <div className="color-picker">
                    {BG_COLORS.map(c => (
                      <button
                        key={c}
                        className={`color-swatch ${postBg === c ? 'selected' : ''}`}
                        style={{ background: c, border: c === '#ffffff' ? '1px solid var(--border)' : 'none' }}
                        onClick={() => setPostBg(c)}
                        title={c}
                      />
                    ))}
                  </div>

                  <label>{t('statuses.font', { defaultValue: 'Font' })}</label>
                  <div className="font-picker">
                    {FONT_NAMES.map((name, i) => (
                      <button
                        key={i}
                        className={`font-btn ${postFont === i ? 'active' : ''}`}
                        onClick={() => setPostFont(i)}
                      >
                        {name}
                      </button>
                    ))}
                  </div>

                  {/* Preview */}
                  {postText && (
                    <div
                      className="status-preview"
                      style={{
                        background: postBg,
                        fontFamily: ['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'][postFont],
                        color: postBg === '#ffffff' || postBg === '#ffd700' ? '#111' : '#fff',
                      }}
                    >
                      {postText}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <label>{t('statuses.imageUrl', { defaultValue: 'Image URL' })}</label>
                  <input
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    value={postImageUrl}
                    onChange={e => setPostImageUrl(e.target.value)}
                  />
                  <label style={{ marginTop: '0.75rem' }}>{t('statuses.caption', { defaultValue: 'Caption (optional)' })}</label>
                  <input
                    type="text"
                    placeholder={t('statuses.captionPlaceholder', { defaultValue: 'Add a caption...' })}
                    value={postCaption}
                    onChange={e => setPostCaption(e.target.value)}
                  />
                  {postImageUrl && (
                    <div className="image-preview">
                      <img src={postImageUrl} alt="preview" onError={e => (e.currentTarget.style.display = 'none')} />
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={resetModal}>{t('common.cancel')}</button>
              <button
                className="btn-primary"
                onClick={handlePost}
                disabled={postMutation.isPending || (postType === 'text' ? !postText.trim() : !postImageUrl.trim())}
              >
                {postMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {t('statuses.post', { defaultValue: 'Post' })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="modal-overlay" aria-hidden="true" onClick={() => setDeleteTarget(null)}>
          <div className="modal modal--sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('statuses.deleteTitle', { defaultValue: 'Delete Status' })}</h2>
              <button className="btn-icon" onClick={() => setDeleteTarget(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <p>{t('statuses.deleteConfirm', { defaultValue: 'Are you sure you want to delete this status?' })}</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</button>
              <button
                className="btn-danger-solid"
                onClick={() => deleteMutation.mutate(deleteTarget)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
