// API Service Layer for OpenWA Dashboard
// Centralized API client with TypeScript types

export const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '/api';

// =============================================================================
// Types
// =============================================================================

export interface Session {
  id: string;
  name: string;
  status: 'created' | 'idle' | 'initializing' | 'connecting' | 'qr_ready' | 'ready' | 'disconnected';
  phone?: string;
  pushName?: string;
  lastActive?: string;
  createdAt: string;
  updatedAt: string;
  proxyUrl?: string;
  proxyType?: string;
}

export interface SessionStats {
  total: number;
  active: number;
  ready: number;
  disconnected: number;
  byStatus: Record<string, number>;
  memoryUsage: { heapUsed: number; heapTotal: number; rss: number };
}

export interface Webhook {
  id: string;
  sessionId: string;
  url: string;
  events: string[];
  active: boolean;
  secret?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  role: 'admin' | 'operator' | 'viewer';
  allowedIps?: string[];
  allowedSessions?: string[];
  defaultSessionId?: string;
  isActive: boolean;
  expiresAt?: string;
  lastUsedAt?: string;
  usageCount: number;
  createdAt: string;
  apiKey?: string; // Only returned on creation
}

export interface AuditLog {
  id: string;
  action: string;
  severity: 'info' | 'warn' | 'error';
  apiKeyId?: string;
  apiKeyName?: string;
  sessionId?: string;
  sessionName?: string;
  ipAddress?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  errorMessage?: string;
  createdAt: string;
}

export interface MessageResponse {
  messageId: string;
  timestamp: number;
}

export interface HealthStatus {
  status: 'ok' | 'error';
  timestamp?: string;
  details?: {
    database?: { status: string };
    redis?: { status: string };
    queue?: { status: string };
  };
}

export interface InfraStatus {
  database: { connected: boolean; type: string; host: string };
  redis: { connected: boolean; host: string; port: number };
  queue: {
    enabled: boolean;
    messages: { pending: number; completed: number; failed: number };
    webhooks: { pending: number; completed: number; failed: number };
  };
  storage: { type: 'local' | 's3'; path?: string; bucket?: string };
  engine: { type: string; headless: boolean };
}

export interface SaveConfigPayload {
  database?: {
    type: 'sqlite' | 'postgres';
    builtIn?: boolean;
    host?: string;
    port?: string;
    username?: string;
    password?: string;
    database?: string;
    poolSize?: number;
    sslEnabled?: boolean;
  };
  redis?: {
    enabled?: boolean;
    builtIn?: boolean;
    host?: string;
    port?: string;
    password?: string;
  };
  queue?: {
    enabled?: boolean;
  };
  storage?: {
    type: 'local' | 's3';
    builtIn?: boolean;
    localPath?: string;
    s3Bucket?: string;
    s3Region?: string;
    s3AccessKey?: string;
    s3SecretKey?: string;
    s3Endpoint?: string;
  };
  engine?: {
    headless?: boolean;
    sessionDataPath?: string;
    browserArgs?: string;
  };
}

export interface Settings {
  general: { apiBaseUrl: string; sessionTimeout: number; autoReconnect: boolean; debugMode: boolean };
  api: { rateLimit: number; rateLimitWindow: number; enableDocs: boolean };
  notifications: { emailEnabled: boolean; notificationEmail: string; webhookAlerts: boolean };
}

// =============================================================================
// API Client
// =============================================================================

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  // Prefer JWT when available, fall back to API key
  const jwt = sessionStorage.getItem('openwa_jwt');
  const apiKey = sessionStorage.getItem('openwa_api_key');

  const authHeader: Record<string, string> = jwt
    ? { Authorization: `Bearer ${jwt}` }
    : apiKey
    ? { 'X-API-Key': apiKey }
    : {};

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...authHeader,
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    if (response.status === 401) {
      sessionStorage.removeItem('openwa_jwt');
      sessionStorage.removeItem('openwa_api_key');
      window.location.reload();
    }
    const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// =============================================================================
// Session API
// =============================================================================

export const sessionApi = {
  list: () => request<Session[]>('/sessions'),
  get: (id: string) => request<Session>(`/sessions/${id}`),
  create: (name: string) =>
    request<Session>('/sessions', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  delete: (id: string) => request<void>(`/sessions/${id}`, { method: 'DELETE' }),
  start: (id: string) => request<Session>(`/sessions/${id}/start`, { method: 'POST' }),
  stop: (id: string) => request<Session>(`/sessions/${id}/stop`, { method: 'POST' }),
  getQR: (id: string) => request<{ qrCode: string; status: string }>(`/sessions/${id}/qr`),
  getStats: () => request<SessionStats>('/sessions/stats/overview'),
  getGroups: (id: string) => request<{ id: string; name: string }[]>(`/sessions/${id}/groups`),
  updateProxy: (id: string, data: { proxyUrl?: string | null; proxyType?: string | null }) =>
    request<Session>(`/sessions/${id}/proxy`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

// =============================================================================
// Webhook API
// =============================================================================

export const webhookApi = {
  listBySession: (sessionId: string) => request<Webhook[]>(`/sessions/${sessionId}/webhooks`),
  listAll: () => request<Webhook[]>('/webhooks'),
  get: (sessionId: string, id: string) => request<Webhook>(`/sessions/${sessionId}/webhooks/${id}`),
  create: (sessionId: string, data: { url: string; events: string[] }) =>
    request<Webhook>(`/sessions/${sessionId}/webhooks`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (sessionId: string, id: string, data: Partial<Webhook>) =>
    request<Webhook>(`/sessions/${sessionId}/webhooks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (sessionId: string, id: string) =>
    request<void>(`/sessions/${sessionId}/webhooks/${id}`, { method: 'DELETE' }),
  test: (sessionId: string, id: string) =>
    request<{ success: boolean; statusCode?: number; error?: string }>(`/sessions/${sessionId}/webhooks/${id}/test`, {
      method: 'POST',
    }),
};

// =============================================================================
// User profile API (JWT auth only)
// =============================================================================

export interface UserProfile {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const userApi = {
  getMe: () => request<UserProfile>('/auth/users/me'),
  updateMe: (email: string) =>
    request<UserProfile>('/auth/users/me', {
      method: 'PUT',
      body: JSON.stringify({ email }),
    }),
  changePassword: (oldPassword: string, newPassword: string) =>
    request<void>('/auth/users/me/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
    }),
};

// =============================================================================
// API Key API
// =============================================================================

export const apiKeyApi = {
  list: () => request<ApiKey[]>('/auth/api-keys'),
  get: (id: string) => request<ApiKey>(`/auth/api-keys/${id}`),
  create: (data: {
    name: string;
    role: string;
    allowedIps?: string[];
    allowedSessions?: string[];
    defaultSessionId?: string;
    expiresAt?: string;
  }) =>
    request<ApiKey>('/auth/api-keys', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: { name?: string; role?: string; defaultSessionId?: string | null; allowedSessions?: string[]; expiresAt?: string }) =>
    request<ApiKey>(`/auth/api-keys/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) => request<void>(`/auth/api-keys/${id}`, { method: 'DELETE' }),
  revoke: (id: string) => request<ApiKey>(`/auth/api-keys/${id}/revoke`, { method: 'POST' }),
};

// =============================================================================
// Audit/Logs API
// =============================================================================

export const auditApi = {
  list: (params?: { action?: string; severity?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.action) query.set('action', params.action);
    if (params?.severity) query.set('severity', params.severity);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const queryStr = query.toString();
    return request<{ data: AuditLog[]; total: number }>(`/audit${queryStr ? `?${queryStr}` : ''}`);
  },
};

// =============================================================================
// Message API
// =============================================================================

export const messageApi = {
  sendText: (sessionId: string, chatId: string, text: string) =>
    request<MessageResponse>(`/sessions/${sessionId}/messages/send-text`, {
      method: 'POST',
      body: JSON.stringify({ chatId, text }),
    }),
  sendImage: (sessionId: string, chatId: string, url: string, caption?: string) =>
    request<MessageResponse>(`/sessions/${sessionId}/messages/send-image`, {
      method: 'POST',
      body: JSON.stringify({ chatId, url, caption }),
    }),
  sendVideo: (sessionId: string, chatId: string, url: string, caption?: string) =>
    request<MessageResponse>(`/sessions/${sessionId}/messages/send-video`, {
      method: 'POST',
      body: JSON.stringify({ chatId, url, caption }),
    }),
  sendAudio: (sessionId: string, chatId: string, url: string) =>
    request<MessageResponse>(`/sessions/${sessionId}/messages/send-audio`, {
      method: 'POST',
      body: JSON.stringify({ chatId, url }),
    }),
  sendDocument: (sessionId: string, chatId: string, url: string, filename?: string) =>
    request<MessageResponse>(`/sessions/${sessionId}/messages/send-document`, {
      method: 'POST',
      body: JSON.stringify({ chatId, url, filename }),
    }),
};

// =============================================================================
// Health & Infrastructure API
// =============================================================================

export const healthApi = {
  check: () => request<HealthStatus>('/health'),
  ready: () => request<HealthStatus>('/health/ready'),
};

export const infraApi = {
  getStatus: () => request<InfraStatus>('/infra/status'),
  updateConfig: (config: Partial<InfraStatus>) =>
    request<InfraStatus>('/infra/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    }),
  saveConfig: (config: SaveConfigPayload) =>
    request<{ message: string; saved: boolean; envPath: string; profiles: string[] }>('/infra/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    }),
  restart: (profiles?: string[], profilesToRemove?: string[]) =>
    request<{
      message: string;
      restarting: boolean;
      profiles: string[];
      profilesToRemove: string[];
      estimatedTime: number;
    }>('/infra/restart', {
      method: 'POST',
      body: JSON.stringify({ profiles: profiles || [], profilesToRemove: profilesToRemove || [] }),
    }),
  healthCheck: () => request<{ status: string; timestamp: string }>('/infra/health'),
};

// =============================================================================
// Settings API
// =============================================================================

export const settingsApi = {
  get: () => request<Settings>('/settings'),
  update: (settings: Partial<Settings>) =>
    request<Settings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
};

// =============================================================================
// Stats API
// =============================================================================

export interface SystemMetrics {
  uptime: number;
  uptimeHuman: string;
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    heapUsedMb: number;
    heapTotalMb: number;
    rssMb: number;
  };
  nodeVersion: string;
  platform: string;
  env: string;
  queueEnabled: boolean;
  redisEnabled: boolean;
  sessionsActive: number;
  messagesTotal: number;
  messagesToday: number;
}

export interface OverviewStats {
  sessions: { active: number; total: number; byStatus: Record<string, number> };
  messages: {
    sent: number;
    received: number;
    failed: number;
    today: { sent: number; received: number };
  };
}

export const statsApi = {
  getOverview: () => request<OverviewStats>('/stats/overview'),
  getSystemMetrics: () => request<SystemMetrics>('/stats/system'),
  getMessageStats: (period: '24h' | '7d' | '30d' = '24h') =>
    request<{
      timeSeries: Array<{ timestamp: string; sent: number; received: number }>;
      byType: Record<string, number>;
      bySession: Array<{ sessionId: string; name: string; sent: number; received: number }>;
      topChats: Array<{ chatId: string; messageCount: number }>;
    }>(`/stats/messages?period=${period}`),
};

// =============================================================================
// Plugin Types
// =============================================================================

export interface PluginConfigSchema {
  type: 'object';
  properties: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    title?: string;
    description?: string;
    default?: unknown;
    enum?: unknown[];
    required?: boolean;
    secret?: boolean;
  }>;
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  type: 'engine' | 'storage' | 'queue' | 'auth' | 'extension';
  description?: string;
  author?: string;
  status: 'installed' | 'enabled' | 'disabled' | 'error';
  config: Record<string, unknown>;
  configSchema?: PluginConfigSchema;
  builtIn: boolean;
  provides: string[];
  loadedAt?: string;
  enabledAt?: string;
  error?: string;
}

export interface MarketplacePlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  type: string;
  builtIn: boolean;
  installed: boolean;
  npmPackage?: string;
  repositoryUrl?: string;
  tags: string[];
}

export interface Engine {
  id: string;
  name: string;
  enabled: boolean;
  features: string[];
}

// =============================================================================
// Plugins API
// =============================================================================

export const pluginsApi = {
  list: () => request<Plugin[]>('/plugins'),
  get: (id: string) => request<Plugin>(`/plugins/${id}`),
  enable: (id: string) =>
    request<{ success: boolean; message: string }>(`/plugins/${id}/enable`, {
      method: 'POST',
    }),
  disable: (id: string) =>
    request<{ success: boolean; message: string }>(`/plugins/${id}/disable`, {
      method: 'POST',
    }),
  updateConfig: (id: string, config: Record<string, unknown>) =>
    request<{ success: boolean; message: string }>(`/plugins/${id}/config`, {
      method: 'PUT',
      body: JSON.stringify({ config }),
    }),
  healthCheck: (id: string) => request<{ healthy: boolean; message?: string }>(`/plugins/${id}/health`),
  getEngines: () => request<Engine[]>('/infra/engines'),
  getCurrentEngine: () => request<{ engineType: string }>('/infra/engines/current'),
  getMarketplace: () => request<MarketplacePlugin[]>('/plugins/marketplace'),
};

// =============================================================================
// Channel API
// =============================================================================

export interface Channel {
  id: string;
  name: string;
  description?: string;
  subscriberCount?: number;
  verified?: boolean;
  pictureUrl?: string;
}

export const channelApi = {
  list: (sessionId: string) => request<Channel[]>(`/sessions/${sessionId}/channels`),
  get: (sessionId: string, channelId: string) => request<Channel>(`/sessions/${sessionId}/channels/${channelId}`),
  subscribe: (sessionId: string, inviteCode: string) =>
    request<{ success: boolean }>(`/sessions/${sessionId}/channels/subscribe`, {
      method: 'POST',
      body: JSON.stringify({ inviteCode }),
    }),
  unsubscribe: (sessionId: string, channelId: string) =>
    request<{ success: boolean }>(`/sessions/${sessionId}/channels/${channelId}`, {
      method: 'DELETE',
    }),
};

// =============================================================================
// Groups API
// =============================================================================

export interface GroupParticipant {
  id: string;
  number: string;
  name?: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export interface Group {
  id: string;
  name: string;
  participantsCount?: number;
  isAdmin?: boolean;
}

export interface GroupInfo extends Group {
  description?: string;
  owner?: string;
  createdAt?: string;
  participants: GroupParticipant[];
  isReadOnly?: boolean;
  isAnnounce?: boolean;
}

export const groupApi = {
  list: (sessionId: string) =>
    request<Group[]>(`/sessions/${sessionId}/groups`),
  get: (sessionId: string, groupId: string) =>
    request<GroupInfo>(`/sessions/${sessionId}/groups/${encodeURIComponent(groupId)}`),
  create: (sessionId: string, data: { name: string; participants: string[] }) =>
    request<Group>(`/sessions/${sessionId}/groups`, { method: 'POST', body: JSON.stringify(data) }),
  getInviteCode: (sessionId: string, groupId: string) =>
    request<{ inviteCode: string; inviteLink: string }>(`/sessions/${sessionId}/groups/${encodeURIComponent(groupId)}/invite-code`),
  revokeInviteCode: (sessionId: string, groupId: string) =>
    request<{ inviteCode: string; inviteLink: string; message: string }>(
      `/sessions/${sessionId}/groups/${encodeURIComponent(groupId)}/invite-code/revoke`,
      { method: 'POST' },
    ),
  leave: (sessionId: string, groupId: string) =>
    request<{ success: boolean; message: string }>(`/sessions/${sessionId}/groups/${encodeURIComponent(groupId)}/leave`, { method: 'POST' }),
  join: (sessionId: string, inviteCode: string) =>
    request<Group>(`/sessions/${sessionId}/groups/join`, { method: 'POST', body: JSON.stringify({ inviteCode }) }),
  addParticipants: (sessionId: string, groupId: string, participants: string[]) =>
    request<{ success: boolean; message: string }>(
      `/sessions/${sessionId}/groups/${encodeURIComponent(groupId)}/participants`,
      { method: 'POST', body: JSON.stringify({ participants }) },
    ),
  removeParticipants: (sessionId: string, groupId: string, participants: string[]) =>
    request<{ success: boolean; message: string }>(
      `/sessions/${sessionId}/groups/${encodeURIComponent(groupId)}/participants`,
      { method: 'DELETE', body: JSON.stringify({ participants }) },
    ),
  promoteParticipants: (sessionId: string, groupId: string, participants: string[]) =>
    request<{ success: boolean; message: string }>(
      `/sessions/${sessionId}/groups/${encodeURIComponent(groupId)}/participants/promote`,
      { method: 'POST', body: JSON.stringify({ participants }) },
    ),
  demoteParticipants: (sessionId: string, groupId: string, participants: string[]) =>
    request<{ success: boolean; message: string }>(
      `/sessions/${sessionId}/groups/${encodeURIComponent(groupId)}/participants/demote`,
      { method: 'POST', body: JSON.stringify({ participants }) },
    ),
};

// =============================================================================
// Contacts API
// =============================================================================

export interface Contact {
  id: string;
  name?: string;
  pushName?: string;
  number: string;
  isMyContact: boolean;
  isBlocked: boolean;
  profilePicUrl?: string;
}

export interface NumberCheckResult {
  number: string;
  exists: boolean;
  whatsappId: string | null;
}

export const contactApi = {
  list: (sessionId: string) =>
    request<Contact[]>(`/sessions/${sessionId}/contacts`),
  get: (sessionId: string, contactId: string) =>
    request<Contact>(`/sessions/${sessionId}/contacts/${encodeURIComponent(contactId)}`),
  check: (sessionId: string, number: string) =>
    request<NumberCheckResult>(`/sessions/${sessionId}/contacts/check/${encodeURIComponent(number)}`),
  block: (sessionId: string, contactId: string) =>
    request<{ success: boolean; message: string }>(
      `/sessions/${sessionId}/contacts/${encodeURIComponent(contactId)}/block`,
      { method: 'POST' },
    ),
  unblock: (sessionId: string, contactId: string) =>
    request<{ success: boolean; message: string }>(
      `/sessions/${sessionId}/contacts/${encodeURIComponent(contactId)}/block`,
      { method: 'DELETE' },
    ),
};

// =============================================================================
// Statuses API
// =============================================================================

export interface StatusContact {
  id: string;
  name?: string;
  pushName?: string;
}

export interface Status {
  id: string;
  contact: StatusContact;
  type: 'text' | 'image' | 'video';
  caption?: string;
  mediaUrl?: string;
  backgroundColor?: string;
  font?: number;
  timestamp: string;
  expiresAt: string;
}

export interface StatusResult {
  statusId: string;
  timestamp: string;
  expiresAt: string;
}

export const statusApi = {
  getAll: (sessionId: string) =>
    request<{ statuses: Status[] }>(`/sessions/${sessionId}/status`),
  sendText: (sessionId: string, data: { text: string; backgroundColor?: string; font?: number }) =>
    request<StatusResult>(`/sessions/${sessionId}/status/send-text`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  sendImage: (sessionId: string, data: { image: { url?: string }; caption?: string }) =>
    request<StatusResult>(`/sessions/${sessionId}/status/send-image`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  delete: (sessionId: string, statusId: string) =>
    request<{ message: string }>(`/sessions/${sessionId}/status/${encodeURIComponent(statusId)}`, {
      method: 'DELETE',
    }),
};
