import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Plus,
  Search,
  Link2,
  LogOut,
  Copy,
  UserPlus,
  UserMinus,
  ShieldCheck,
  ShieldOff,
  Loader2,
  X,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { sessionApi, groupApi, type Session, type Group, type GroupInfo, type GroupParticipant } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/Toast';
import './Groups.css';

function getInitials(name?: string, number?: string): string {
  const source = name?.trim() || number?.trim() || '?';
  const words = source.split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return source.substring(0, 2).toUpperCase();
}

function ParticipantRow({
  participant,
  isAdmin: viewerIsAdmin,
  sessionId,
  groupId,
  onAction,
}: {
  participant: GroupParticipant;
  isAdmin: boolean;
  sessionId: string;
  groupId: string;
  onAction: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  const removeMutation = useMutation({
    mutationFn: () => groupApi.removeParticipants(sessionId, groupId, [participant.id]),
    onSuccess: () => {
      toast.success(
        t('groups.detail.participantRemoved', { defaultValue: 'Participant removed' }),
        participant.name || participant.number,
      );
      void queryClient.invalidateQueries({ queryKey: ['group-detail', sessionId, groupId] });
      onAction();
    },
    onError: (err: Error) => {
      toast.error(t('groups.errors.removeParticipant', { defaultValue: 'Failed to remove participant' }), err.message);
    },
  });

  const promoteMutation = useMutation({
    mutationFn: () => groupApi.promoteParticipants(sessionId, groupId, [participant.id]),
    onSuccess: () => {
      toast.success(t('groups.detail.participantPromoted', { defaultValue: 'Promoted to admin' }));
      void queryClient.invalidateQueries({ queryKey: ['group-detail', sessionId, groupId] });
    },
    onError: (err: Error) => {
      toast.error(t('groups.errors.promoteParticipant', { defaultValue: 'Failed to promote participant' }), err.message);
    },
  });

  const demoteMutation = useMutation({
    mutationFn: () => groupApi.demoteParticipants(sessionId, groupId, [participant.id]),
    onSuccess: () => {
      toast.success(t('groups.detail.participantDemoted', { defaultValue: 'Demoted from admin' }));
      void queryClient.invalidateQueries({ queryKey: ['group-detail', sessionId, groupId] });
    },
    onError: (err: Error) => {
      toast.error(t('groups.errors.demoteParticipant', { defaultValue: 'Failed to demote participant' }), err.message);
    },
  });

  const busy = removeMutation.isPending || promoteMutation.isPending || demoteMutation.isPending;

  return (
    <div className="participant-row">
      <div className="participant-avatar">{getInitials(participant.name, participant.number)}</div>
      <div className="participant-info">
        {participant.name && <span className="participant-name">{participant.name}</span>}
        <span className="participant-number">{participant.number}</span>
      </div>
      <div className="participant-badges">
        {participant.isSuperAdmin && (
          <span className="badge badge-superadmin">
            {t('groups.badge.superAdmin', { defaultValue: 'Super Admin' })}
          </span>
        )}
        {participant.isAdmin && !participant.isSuperAdmin && (
          <span className="badge badge-admin">{t('groups.badge.admin', { defaultValue: 'Admin' })}</span>
        )}
      </div>
      {viewerIsAdmin && !participant.isSuperAdmin && (
        <div className="participant-actions">
          {participant.isAdmin ? (
            <button
              className="icon-btn"
              title={t('groups.actions.demote', { defaultValue: 'Demote' })}
              disabled={busy}
              onClick={() => demoteMutation.mutate()}
            >
              {demoteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <ShieldOff size={14} />}
            </button>
          ) : (
            <button
              className="icon-btn"
              title={t('groups.actions.promote', { defaultValue: 'Promote to admin' })}
              disabled={busy}
              onClick={() => promoteMutation.mutate()}
            >
              {promoteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            </button>
          )}
          <button
            className="icon-btn danger"
            title={t('groups.actions.removeParticipant', { defaultValue: 'Remove' })}
            disabled={busy}
            onClick={() => removeMutation.mutate()}
          >
            {removeMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <UserMinus size={14} />}
          </button>
        </div>
      )}
    </div>
  );
}

function GroupDetailPanel({
  sessionId,
  group,
  onClose,
}: {
  sessionId: string;
  group: Group;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [addNumbers, setAddNumbers] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: info, isLoading } = useQuery<GroupInfo>({
    queryKey: ['group-detail', sessionId, group.id],
    queryFn: () => groupApi.get(sessionId, group.id),
    staleTime: 15_000,
  });

  const inviteMutation = useMutation({
    mutationFn: () => groupApi.getInviteCode(sessionId, group.id),
    onSuccess: (data) => {
      void navigator.clipboard.writeText(data.inviteLink).then(() => {
        toast.success(
          t('groups.detail.inviteCopied', { defaultValue: 'Invite link copied' }),
          data.inviteLink,
        );
      });
    },
    onError: (err: Error) => {
      toast.error(t('groups.errors.getInvite', { defaultValue: 'Failed to get invite link' }), err.message);
    },
  });

  const addMutation = useMutation({
    mutationFn: (participants: string[]) => groupApi.addParticipants(sessionId, group.id, participants),
    onSuccess: () => {
      toast.success(t('groups.detail.participantsAdded', { defaultValue: 'Participants added' }));
      setAddNumbers('');
      setShowAddForm(false);
      void queryClient.invalidateQueries({ queryKey: ['group-detail', sessionId, group.id] });
      void queryClient.invalidateQueries({ queryKey: ['groups', sessionId] });
    },
    onError: (err: Error) => {
      toast.error(t('groups.errors.addParticipants', { defaultValue: 'Failed to add participants' }), err.message);
    },
  });

  const handleAdd = () => {
    const participants = addNumbers
      .split('\n')
      .map(n => n.trim())
      .filter(Boolean);
    if (participants.length === 0) return;
    addMutation.mutate(participants);
  };

  return (
    <div className="group-detail-panel">
      <div className="detail-panel-header">
        <div className="detail-panel-title">
          <h3>{group.name}</h3>
          {group.isAdmin && (
            <span className="badge badge-admin">{t('groups.badge.admin', { defaultValue: 'Admin' })}</span>
          )}
        </div>
        <button className="btn-icon" onClick={onClose} aria-label={t('common.close', { defaultValue: 'Close' })}>
          <X size={18} />
        </button>
      </div>

      {isLoading ? (
        <div className="detail-loading">
          <Loader2 size={28} className="animate-spin" />
        </div>
      ) : info ? (
        <>
          {info.description && (
            <div className="detail-section">
              <span className="detail-section-label">
                {t('groups.detail.description', { defaultValue: 'Description' })}
              </span>
              <p className="detail-section-text">{info.description}</p>
            </div>
          )}

          {info.owner && (
            <div className="detail-section">
              <span className="detail-section-label">
                {t('groups.detail.owner', { defaultValue: 'Owner' })}
              </span>
              <p className="detail-section-text mono">{info.owner}</p>
            </div>
          )}

          <div className="detail-invite-row">
            <button
              className="btn-secondary btn-sm-full"
              onClick={() => inviteMutation.mutate()}
              disabled={inviteMutation.isPending}
            >
              {inviteMutation.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Copy size={14} />
              )}
              {t('groups.detail.copyInviteLink', { defaultValue: 'Copy Invite Link' })}
            </button>
          </div>

          <div className="detail-participants-header">
            <span className="detail-section-label">
              {t('groups.detail.participants', { defaultValue: 'Participants' })} ({info.participants.length})
            </span>
            {info.isAdmin && (
              <button
                className="icon-btn"
                title={t('groups.actions.addParticipant', { defaultValue: 'Add participant' })}
                onClick={() => setShowAddForm(f => !f)}
              >
                <UserPlus size={14} />
              </button>
            )}
          </div>

          {showAddForm && (
            <div className="add-participant-form">
              <textarea
                rows={3}
                placeholder={t('groups.addParticipants.placeholder', {
                  defaultValue: 'One phone number per line\ne.g. 15550001234',
                })}
                value={addNumbers}
                onChange={e => setAddNumbers(e.target.value)}
              />
              <div className="add-participant-actions">
                <button className="btn-secondary btn-xs" onClick={() => { setShowAddForm(false); setAddNumbers(''); }}>
                  {t('common.cancel', { defaultValue: 'Cancel' })}
                </button>
                <button
                  className="btn-primary btn-xs"
                  onClick={handleAdd}
                  disabled={addMutation.isPending || !addNumbers.trim()}
                >
                  {addMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : null}
                  {t('groups.actions.add', { defaultValue: 'Add' })}
                </button>
              </div>
            </div>
          )}

          <div className="participants-list">
            {info.participants.map(p => (
              <ParticipantRow
                key={p.id}
                participant={p}
                isAdmin={!!info.isAdmin}
                sessionId={sessionId}
                groupId={group.id}
                onAction={() => {
                  void queryClient.invalidateQueries({ queryKey: ['groups', sessionId] });
                }}
              />
            ))}
          </div>
        </>
      ) : (
        <p className="detail-error">
          {t('groups.errors.loadDetail', { defaultValue: 'Failed to load group details' })}
        </p>
      )}
    </div>
  );
}

export function Groups() {
  const { t } = useTranslation();
  useDocumentTitle(t('groups.title', { defaultValue: 'Groups' }));
  const toast = useToast();
  const queryClient = useQueryClient();

  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createParticipants, setCreateParticipants] = useState('');

  // Join modal
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  // Leave confirm
  const [leaveTarget, setLeaveTarget] = useState<Group | null>(null);

  // Sessions query
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<Session[]>({
    queryKey: ['sessions'],
    queryFn: () => sessionApi.list(),
    staleTime: 30_000,
  });

  const readySessions = sessions.filter(s => s.status === 'ready');

  // Groups query
  const {
    data: groups = [],
    isLoading: groupsLoading,
    refetch: refetchGroups,
    isRefetching,
  } = useQuery<Group[]>({
    queryKey: ['groups', selectedSessionId],
    queryFn: () => groupApi.list(selectedSessionId),
    enabled: !!selectedSessionId,
    staleTime: 20_000,
  });

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Create mutation
  const createMutation = useMutation({
    mutationFn: () => {
      const participants = createParticipants
        .split('\n')
        .map(n => n.trim())
        .filter(Boolean);
      return groupApi.create(selectedSessionId, { name: createName.trim(), participants });
    },
    onSuccess: (newGroup) => {
      toast.success(
        t('groups.toasts.created', { defaultValue: 'Group created' }),
        newGroup.name,
      );
      setShowCreateModal(false);
      setCreateName('');
      setCreateParticipants('');
      void queryClient.invalidateQueries({ queryKey: ['groups', selectedSessionId] });
    },
    onError: (err: Error) => {
      toast.error(t('groups.errors.create', { defaultValue: 'Failed to create group' }), err.message);
    },
  });

  // Join mutation
  const joinMutation = useMutation({
    mutationFn: () => {
      // Accept full invite link or bare code
      const code = joinCode.trim().split('/').pop() ?? joinCode.trim();
      return groupApi.join(selectedSessionId, code);
    },
    onSuccess: (joined) => {
      toast.success(
        t('groups.toasts.joined', { defaultValue: 'Joined group' }),
        joined.name,
      );
      setShowJoinModal(false);
      setJoinCode('');
      void queryClient.invalidateQueries({ queryKey: ['groups', selectedSessionId] });
    },
    onError: (err: Error) => {
      toast.error(t('groups.errors.join', { defaultValue: 'Failed to join group' }), err.message);
    },
  });

  // Leave mutation
  const leaveMutation = useMutation({
    mutationFn: (groupId: string) => groupApi.leave(selectedSessionId, groupId),
    onSuccess: (_data, groupId) => {
      const name = groups.find(g => g.id === groupId)?.name;
      toast.success(
        t('groups.toasts.left', { defaultValue: 'Left group' }),
        name,
      );
      if (selectedGroup?.id === groupId) setSelectedGroup(null);
      setLeaveTarget(null);
      void queryClient.invalidateQueries({ queryKey: ['groups', selectedSessionId] });
    },
    onError: (err: Error) => {
      toast.error(t('groups.errors.leave', { defaultValue: 'Failed to leave group' }), err.message);
      setLeaveTarget(null);
    },
  });

  const handleSessionChange = useCallback((id: string) => {
    setSelectedSessionId(id);
    setSelectedGroup(null);
    setSearchQuery('');
  }, []);

  const handleGroupClick = useCallback((group: Group) => {
    setSelectedGroup(prev => (prev?.id === group.id ? null : group));
  }, []);

  const isDetailOpen = !!selectedGroup;

  return (
    <div className="groups-page">
      <PageHeader
        title={t('groups.title', { defaultValue: 'Groups' })}
        subtitle={t('groups.subtitle', { defaultValue: 'Manage WhatsApp groups across your sessions' })}
        actions={
          selectedSessionId ? (
            <div className="groups-header-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowJoinModal(true)}
              >
                <Link2 size={16} />
                {t('groups.actions.joinGroup', { defaultValue: 'Join Group' })}
              </button>
              <button
                className="btn-primary"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus size={16} />
                {t('groups.actions.createGroup', { defaultValue: 'Create Group' })}
              </button>
            </div>
          ) : null
        }
      />

      {/* Session selector */}
      <div className="groups-session-bar">
        <div className="session-select-wrapper">
          {sessionsLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <select
              value={selectedSessionId}
              onChange={e => handleSessionChange(e.target.value)}
            >
              <option value="">
                {t('groups.selectSession', { defaultValue: '— Select a session —' })}
              </option>
              {readySessions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.phone ? ` (${s.phone})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedSessionId && (
          <>
            <div className="search-input">
              <Search size={16} />
              <input
                type="text"
                placeholder={t('groups.searchPlaceholder', { defaultValue: 'Search groups…' })}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="clear-search" onClick={() => setSearchQuery('')}>
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              className="btn-icon"
              title={t('groups.actions.refresh', { defaultValue: 'Refresh' })}
              onClick={() => void refetchGroups()}
              disabled={isRefetching}
            >
              <RefreshCw size={16} className={isRefetching ? 'animate-spin' : ''} />
            </button>
          </>
        )}
      </div>

      {/* Main layout */}
      <div className={`groups-layout${isDetailOpen ? ' detail-open' : ''}`}>
        {/* Groups table */}
        <div className="groups-table-container">
          {!selectedSessionId ? (
            <div className="empty-table-state">
              <Users size={48} strokeWidth={1} />
              <h3>{t('groups.empty.noSession', { defaultValue: 'No session selected' })}</h3>
              <p>{t('groups.empty.noSessionDesc', { defaultValue: 'Select a ready session above to view its groups.' })}</p>
            </div>
          ) : groupsLoading ? (
            <div className="groups-loading">
              <Loader2 size={32} className="animate-spin" />
              <span>{t('groups.loading', { defaultValue: 'Loading groups…' })}</span>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="empty-table-state">
              <Users size={48} strokeWidth={1} />
              <h3>
                {searchQuery
                  ? t('groups.empty.noResults', { defaultValue: 'No matching groups' })
                  : t('groups.empty.noGroups', { defaultValue: 'No groups found' })}
              </h3>
              <p>
                {searchQuery
                  ? t('groups.empty.noResultsDesc', { defaultValue: 'Try a different search term.' })
                  : t('groups.empty.noGroupsDesc', {
                      defaultValue: 'This session has no groups yet. Create or join one.',
                    })}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table header */}
              <div className="groups-table">
                <div className="group-table-row header">
                  <span>{t('groups.columns.name', { defaultValue: 'Name' })}</span>
                  <span>{t('groups.columns.participants', { defaultValue: 'Participants' })}</span>
                  <span>{t('groups.columns.role', { defaultValue: 'Role' })}</span>
                  <span>{t('groups.columns.actions', { defaultValue: 'Actions' })}</span>
                </div>

                {filteredGroups.map(group => {
                  const isSelected = selectedGroup?.id === group.id;
                  return (
                    <div
                      key={group.id}
                      className={`group-table-row${isSelected ? ' selected' : ''}`}
                      onClick={() => handleGroupClick(group)}
                    >
                      <span className="group-name-cell">
                        <span className="group-name-text">{group.name}</span>
                        <ChevronRight size={14} className={`row-chevron${isSelected ? ' open' : ''}`} />
                      </span>
                      <span>
                        {group.participantsCount != null ? (
                          <span className="count-badge">
                            <Users size={12} />
                            {group.participantsCount}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </span>
                      <span>
                        {group.isAdmin ? (
                          <span className="badge badge-admin">
                            {t('groups.badge.admin', { defaultValue: 'Admin' })}
                          </span>
                        ) : (
                          <span className="badge badge-member">
                            {t('groups.badge.member', { defaultValue: 'Member' })}
                          </span>
                        )}
                      </span>
                      <span className="actions-cell" onClick={e => e.stopPropagation()}>
                        <button
                          className="icon-btn"
                          title={t('groups.actions.details', { defaultValue: 'Details' })}
                          onClick={() => handleGroupClick(group)}
                        >
                          <Users size={15} />
                        </button>
                        <button
                          className="icon-btn danger"
                          title={t('groups.actions.leave', { defaultValue: 'Leave group' })}
                          onClick={() => setLeaveTarget(group)}
                          disabled={leaveMutation.isPending && leaveTarget?.id === group.id}
                        >
                          {leaveMutation.isPending && leaveTarget?.id === group.id ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <LogOut size={15} />
                          )}
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Mobile cards */}
              <div className="groups-cards">
                {filteredGroups.map(group => {
                  const isSelected = selectedGroup?.id === group.id;
                  return (
                    <div
                      key={group.id}
                      className={`group-card${isSelected ? ' selected' : ''}`}
                      onClick={() => handleGroupClick(group)}
                    >
                      <div className="group-card-main">
                        <div className="group-card-info">
                          <span className="group-card-name">{group.name}</span>
                          <div className="group-card-meta">
                            {group.participantsCount != null && (
                              <span className="count-badge">
                                <Users size={11} />
                                {group.participantsCount}
                              </span>
                            )}
                            {group.isAdmin ? (
                              <span className="badge badge-admin">
                                {t('groups.badge.admin', { defaultValue: 'Admin' })}
                              </span>
                            ) : (
                              <span className="badge badge-member">
                                {t('groups.badge.member', { defaultValue: 'Member' })}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="group-card-actions" onClick={e => e.stopPropagation()}>
                          <button
                            className="icon-btn"
                            title={t('groups.actions.details', { defaultValue: 'Details' })}
                            onClick={() => handleGroupClick(group)}
                          >
                            <Users size={15} />
                          </button>
                          <button
                            className="icon-btn danger"
                            title={t('groups.actions.leave', { defaultValue: 'Leave group' })}
                            onClick={() => setLeaveTarget(group)}
                          >
                            <LogOut size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Detail panel */}
        {selectedGroup && (
          <GroupDetailPanel
            sessionId={selectedSessionId}
            group={selectedGroup}
            onClose={() => setSelectedGroup(null)}
          />
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="modal-overlay" aria-hidden="true" onClick={() => setShowCreateModal(false)}>
          <div role="dialog" aria-modal="true" className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('groups.createModal.title', { defaultValue: 'Create Group' })}</h2>
              <button className="btn-icon" onClick={() => setShowCreateModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <label>{t('groups.createModal.nameLabel', { defaultValue: 'Group Name' })}</label>
              <input
                type="text"
                placeholder={t('groups.createModal.namePlaceholder', { defaultValue: 'e.g. Team Updates' })}
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') e.preventDefault();
                }}
                autoFocus
              />

              <label style={{ marginTop: '1rem' }}>
                {t('groups.createModal.participantsLabel', { defaultValue: 'Participants (optional)' })}
              </label>
              <textarea
                rows={4}
                placeholder={t('groups.createModal.participantsPlaceholder', {
                  defaultValue: 'One phone number per line\ne.g. 15550001234',
                })}
                value={createParticipants}
                onChange={e => setCreateParticipants(e.target.value)}
                style={{ resize: 'vertical' }}
              />
              <p className="input-hint">
                {t('groups.createModal.participantsHint', {
                  defaultValue: 'Enter numbers without + or spaces. At least one participant is required by WhatsApp.',
                })}
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </button>
              <button
                className="btn-primary"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !createName.trim()}
              >
                {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                {t('common.create', { defaultValue: 'Create' })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Group Modal */}
      {showJoinModal && (
        <div className="modal-overlay" aria-hidden="true" onClick={() => setShowJoinModal(false)}>
          <div role="dialog" aria-modal="true" className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('groups.joinModal.title', { defaultValue: 'Join Group' })}</h2>
              <button className="btn-icon" onClick={() => setShowJoinModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <label>{t('groups.joinModal.codeLabel', { defaultValue: 'Invite Code or Link' })}</label>
              <input
                type="text"
                placeholder={t('groups.joinModal.codePlaceholder', {
                  defaultValue: 'https://chat.whatsapp.com/… or just the code',
                })}
                value={joinCode}
                onChange={e => setJoinCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && joinMutation.mutate()}
                autoFocus
              />
              <p className="input-hint">
                {t('groups.joinModal.hint', {
                  defaultValue: 'Paste the full invite link or just the alphanumeric code at the end.',
                })}
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowJoinModal(false)}>
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </button>
              <button
                className="btn-primary"
                onClick={() => joinMutation.mutate()}
                disabled={joinMutation.isPending || !joinCode.trim()}
              >
                {joinMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                {t('groups.actions.join', { defaultValue: 'Join' })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Confirm Modal */}
      {leaveTarget && (
        <div className="modal-overlay" aria-hidden="true" onClick={() => setLeaveTarget(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('groups.leaveModal.title', { defaultValue: 'Leave Group' })}</h2>
              <button className="btn-icon" onClick={() => setLeaveTarget(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                {t('groups.leaveModal.confirm', {
                  defaultValue: 'Are you sure you want to leave',
                })}{' '}
                <strong>{leaveTarget.name}</strong>?
              </p>
              <p className="text-muted">
                {t('groups.leaveModal.warning', {
                  defaultValue: 'You will need an invite link to rejoin.',
                })}
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setLeaveTarget(null)}>
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </button>
              <button
                className="btn-danger"
                onClick={() => leaveMutation.mutate(leaveTarget.id)}
                disabled={leaveMutation.isPending}
              >
                {leaveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                {t('groups.actions.leave', { defaultValue: 'Leave' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
