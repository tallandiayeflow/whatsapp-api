import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { userApi } from '../services/api';

interface ProfileModalProps {
  onClose: () => void;
}

export function ProfileModal({ onClose }: ProfileModalProps) {
  const [email, setEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [emailLoading, setEmailLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    userApi.getMe().then(u => {
      setEmail(u.email);
      setNewEmail(u.email);
    }).catch(() => {});
  }, []);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setEmailLoading(true);
    setEmailMsg(null);
    try {
      const u = await userApi.updateMe(newEmail.trim());
      setEmail(u.email);
      setNewEmail(u.email);
      setEmailMsg({ type: 'ok', text: 'Email updated' });
    } catch (err) {
      setEmailMsg({ type: 'err', text: err instanceof Error ? err.message : 'Update failed' });
    } finally {
      setEmailLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'err', text: 'Passwords do not match' });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'err', text: 'Password must be at least 8 characters' });
      return;
    }
    setPasswordLoading(true);
    setPasswordMsg(null);
    try {
      await userApi.changePassword(oldPassword, newPassword);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMsg({ type: 'ok', text: 'Password changed' });
    } catch (err) {
      setPasswordMsg({ type: 'err', text: err instanceof Error ? err.message : 'Change failed' });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-container" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2 className="modal-title">My Profile</h2>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Email section */}
          <section>
            <h3 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', fontWeight: 600 }}>Email address</h3>
            <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder={email}
                style={{ padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)', width: '100%' }}
              />
              {emailMsg && (
                <span style={{ fontSize: '0.8rem', color: emailMsg.type === 'ok' ? 'var(--success-color, #22c55e)' : 'var(--error-color, #ef4444)' }}>
                  {emailMsg.text}
                </span>
              )}
              <button
                type="submit"
                disabled={emailLoading || newEmail === email}
                style={{ alignSelf: 'flex-start', padding: '0.4rem 1rem', borderRadius: 6, background: 'var(--primary-color)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                {emailLoading && <Loader2 size={14} className="animate-spin" />}
                Save email
              </button>
            </form>
          </section>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />

          {/* Password section */}
          <section>
            <h3 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', fontWeight: 600 }}>Change password</h3>
            <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input
                type="password"
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                placeholder="Current password"
                style={{ padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)', width: '100%' }}
              />
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="New password (min 8 chars)"
                style={{ padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)', width: '100%' }}
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                style={{ padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)', width: '100%' }}
              />
              {passwordMsg && (
                <span style={{ fontSize: '0.8rem', color: passwordMsg.type === 'ok' ? 'var(--success-color, #22c55e)' : 'var(--error-color, #ef4444)' }}>
                  {passwordMsg.text}
                </span>
              )}
              <button
                type="submit"
                disabled={passwordLoading || !oldPassword || !newPassword || !confirmPassword}
                style={{ alignSelf: 'flex-start', padding: '0.4rem 1rem', borderRadius: 6, background: 'var(--primary-color)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                {passwordLoading && <Loader2 size={14} className="animate-spin" />}
                Change password
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
