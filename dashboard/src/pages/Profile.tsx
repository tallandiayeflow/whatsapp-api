import { useState, useEffect } from 'react';
import { Loader2, Save, KeyRound, Mail } from 'lucide-react';
import { userApi, type UserProfile } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PageHeader } from '../components/PageHeader';
import './Profile.css';

export function Profile() {
  useDocumentTitle('Profile');

  const isJwtUser = !!sessionStorage.getItem('openwa_jwt');

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');

  // Email form
  const [newEmail, setNewEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Password form
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!isJwtUser) {
      setProfileLoading(false);
      return;
    }
    userApi.getMe()
      .then(u => {
        setProfile(u);
        setNewEmail(u.email);
      })
      .catch(err => setProfileError(err instanceof Error ? err.message : 'Failed to load profile'))
      .finally(() => setProfileLoading(false));
  }, [isJwtUser]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newEmail.trim();
    if (!trimmed || trimmed === profile?.email) return;
    setEmailLoading(true);
    setEmailMsg(null);
    try {
      const u = await userApi.updateMe(trimmed);
      setProfile(u);
      setNewEmail(u.email);
      setEmailMsg({ type: 'ok', text: 'Email updated successfully' });
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
      setPasswordMsg({ type: 'ok', text: 'Password changed successfully' });
    } catch (err) {
      setPasswordMsg({ type: 'err', text: err instanceof Error ? err.message : 'Change failed' });
    } finally {
      setPasswordLoading(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="profile-page">
        <div className="profile-loading">
          <Loader2 size={32} className="animate-spin" />
        </div>
      </div>
    );
  }

  if (!isJwtUser) {
    return (
      <div className="profile-page">
        <PageHeader
          title="Profile"
          subtitle="Manage your account"
        />
        <div className="profile-notice">
          Profile management is only available when authenticated with email and password.
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="profile-page">
        <PageHeader
          title="Profile"
          subtitle="Manage your account"
        />
        <div className="profile-error">{profileError}</div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <PageHeader
        title="Profile"
        subtitle={profile?.email ?? ''}
      />

      <div className="profile-grid">

        {/* Email card */}
        <div className="profile-card">
          <div className="profile-card-header">
            <Mail size={18} />
            <h2>Email address</h2>
          </div>
          <form onSubmit={handleEmailSubmit} className="profile-form">
            <div className="profile-field">
              <label htmlFor="email">New email</label>
              <input
                id="email"
                type="email"
                value={newEmail}
                onChange={e => { setNewEmail(e.target.value); setEmailMsg(null); }}
                placeholder={profile?.email}
                autoComplete="email"
              />
            </div>
            {emailMsg && (
              <p className={`profile-msg profile-msg--${emailMsg.type}`}>{emailMsg.text}</p>
            )}
            <button
              type="submit"
              className="profile-btn"
              disabled={emailLoading || newEmail.trim() === profile?.email || !newEmail.trim()}
            >
              {emailLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save email
            </button>
          </form>
        </div>

        {/* Password card */}
        <div className="profile-card">
          <div className="profile-card-header">
            <KeyRound size={18} />
            <h2>Change password</h2>
          </div>
          <form onSubmit={handlePasswordSubmit} className="profile-form">
            <div className="profile-field">
              <label htmlFor="old-password">Current password</label>
              <input
                id="old-password"
                type="password"
                value={oldPassword}
                onChange={e => { setOldPassword(e.target.value); setPasswordMsg(null); }}
                autoComplete="current-password"
              />
            </div>
            <div className="profile-field">
              <label htmlFor="new-password">New password</label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setPasswordMsg(null); }}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
            </div>
            <div className="profile-field">
              <label htmlFor="confirm-password">Confirm new password</label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setPasswordMsg(null); }}
                autoComplete="new-password"
              />
            </div>
            {passwordMsg && (
              <p className={`profile-msg profile-msg--${passwordMsg.type}`}>{passwordMsg.text}</p>
            )}
            <button
              type="submit"
              className="profile-btn"
              disabled={passwordLoading || !oldPassword || !newPassword || !confirmPassword}
            >
              {passwordLoading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
              Change password
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
