import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Smartphone, Webhook, Key, BarChart2, Settings, Send, FileText, Radio, Puzzle, X } from 'lucide-react';
import { sessionApi, webhookApi, apiKeyApi } from '../services/api';
import type { Session, Webhook as WebhookType, ApiKey } from '../services/api';
import './CommandPalette.css';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookType[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load data when opened
  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setSelectedIndex(0);
    setTimeout(() => inputRef.current?.focus(), 50);

    sessionApi.list().then(setSessions).catch(() => {});
    webhookApi.listAll().then(setWebhooks).catch(() => {});
    apiKeyApi.list().then(setApiKeys).catch(() => {});
  }, [isOpen]);

  // Navigation commands
  const navCommands: CommandItem[] = [
    { id: 'nav-dashboard', label: 'Dashboard', icon: <BarChart2 size={16} />, action: () => { navigate('/'); onClose(); }, category: 'Navigation' },
    { id: 'nav-sessions', label: 'Sessions', icon: <Smartphone size={16} />, action: () => { navigate('/sessions'); onClose(); }, category: 'Navigation' },
    { id: 'nav-webhooks', label: 'Webhooks', icon: <Webhook size={16} />, action: () => { navigate('/webhooks'); onClose(); }, category: 'Navigation' },
    { id: 'nav-api-keys', label: 'Clés API', icon: <Key size={16} />, action: () => { navigate('/api-keys'); onClose(); }, category: 'Navigation' },
    { id: 'nav-message-tester', label: 'Message Tester', icon: <Send size={16} />, action: () => { navigate('/message-tester'); onClose(); }, category: 'Navigation' },
    { id: 'nav-channels', label: 'Channels', icon: <Radio size={16} />, action: () => { navigate('/channels'); onClose(); }, category: 'Navigation' },
    { id: 'nav-plugins', label: 'Plugins', icon: <Puzzle size={16} />, action: () => { navigate('/plugins'); onClose(); }, category: 'Navigation' },
    { id: 'nav-logs', label: 'Logs', icon: <FileText size={16} />, action: () => { navigate('/logs'); onClose(); }, category: 'Navigation' },
    { id: 'nav-stats', label: 'Statistiques', icon: <BarChart2 size={16} />, action: () => { navigate('/stats'); onClose(); }, category: 'Navigation' },
    { id: 'nav-infra', label: 'Infrastructure', icon: <Settings size={16} />, action: () => { navigate('/infrastructure'); onClose(); }, category: 'Navigation' },
  ];

  // Dynamic items from data
  const sessionItems: CommandItem[] = sessions.map(s => ({
    id: `session-${s.id}`,
    label: s.name,
    description: `${s.phone ?? 'No phone'} · ${s.status}`,
    icon: <Smartphone size={16} />,
    action: () => { navigate('/sessions'); onClose(); },
    category: 'Sessions',
  }));

  const webhookItems: CommandItem[] = webhooks.slice(0, 5).map(w => ({
    id: `webhook-${w.id}`,
    label: w.url,
    description: `Session: ${w.sessionId} · ${w.events.join(', ')}`,
    icon: <Webhook size={16} />,
    action: () => { navigate('/webhooks'); onClose(); },
    category: 'Webhooks',
  }));

  const apiKeyItems: CommandItem[] = apiKeys.slice(0, 5).map(k => ({
    id: `apikey-${k.id}`,
    label: k.name,
    description: `${k.keyPrefix}... · ${k.role}`,
    icon: <Key size={16} />,
    action: () => { navigate('/api-keys'); onClose(); },
    category: 'API Keys',
  }));

  const allItems = [...navCommands, ...sessionItems, ...webhookItems, ...apiKeyItems];

  const filteredItems = query.trim()
    ? allItems.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        (item.description ?? '').toLowerCase().includes(query.toLowerCase()) ||
        item.category.toLowerCase().includes(query.toLowerCase())
      )
    : navCommands;

  // Group by category
  const grouped = filteredItems.reduce<Record<string, CommandItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const flatItems = Object.values(grouped).flat();

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      flatItems[selectedIndex]?.action();
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [flatItems, selectedIndex, onClose]);

  if (!isOpen) return null;

  let globalIndex = 0;

  return (
    <div className="cmd-overlay" onClick={onClose}>
      <div className="cmd-modal" onClick={e => e.stopPropagation()} role="dialog" aria-label="Command palette">
        <div className="cmd-input-row">
          <Search size={18} className="cmd-search-icon" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher ou naviguer... (↑↓ Entrée)"
            className="cmd-input"
            autoComplete="off"
          />
          {query && (
            <button className="cmd-clear" onClick={() => setQuery('')}>
              <X size={16} />
            </button>
          )}
          <kbd className="cmd-esc-hint">ESC</kbd>
        </div>

        <div className="cmd-list" ref={listRef}>
          {filteredItems.length === 0 ? (
            <div className="cmd-empty">Aucun résultat pour &quot;{query}&quot;</div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category} className="cmd-group">
                <div className="cmd-group-label">{category}</div>
                {items.map(item => {
                  const idx = globalIndex++;
                  return (
                    <button
                      key={item.id}
                      data-index={idx}
                      className={`cmd-item ${idx === selectedIndex ? 'selected' : ''}`}
                      onClick={item.action}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <span className="cmd-item-icon">{item.icon}</span>
                      <span className="cmd-item-content">
                        <span className="cmd-item-label">{item.label}</span>
                        {item.description && <span className="cmd-item-desc">{item.description}</span>}
                      </span>
                      {idx === selectedIndex && <kbd className="cmd-enter-hint">↵</kbd>}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="cmd-footer">
          <span><kbd>↑↓</kbd> naviguer</span>
          <span><kbd>↵</kbd> ouvrir</span>
          <span><kbd>Esc</kbd> fermer</span>
        </div>
      </div>
    </div>
  );
}
