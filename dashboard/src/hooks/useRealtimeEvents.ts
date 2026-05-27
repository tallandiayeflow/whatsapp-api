import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useToast } from '../components/Toast';
import { API_BASE_URL } from '../services/api';

// Strip trailing /api to get the socket.io server root
const WS_URL = API_BASE_URL.startsWith('http')
  ? API_BASE_URL.replace(/\/api\/?$/, '')
  : '';

const STATUS_LABELS: Record<string, { title: string; kind: 'success' | 'error' | 'warning' | 'info' }> = {
  ready:         { title: 'Session prête',          kind: 'success' },
  disconnected:  { title: 'Session déconnectée',    kind: 'error'   },
  connecting:    { title: 'Session en connexion…',  kind: 'info'    },
  qr_ready:      { title: 'QR code disponible',     kind: 'info'    },
  initializing:  { title: 'Session démarre…',       kind: 'info'    },
};

export function useRealtimeEvents() {
  const toast = useToast();
  const socketRef = useRef<Socket | null>(null);
  // Keep toast stable across renders
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  useEffect(() => {
    const apiKey = sessionStorage.getItem('openwa_api_key');
    const jwt    = sessionStorage.getItem('openwa_jwt');
    if (!apiKey && !jwt) return;

    const query: Record<string, string> = {};
    const headers: Record<string, string> = {};
    if (apiKey) {
      query.apiKey = apiKey;
    } else if (jwt) {
      headers.authorization = `Bearer ${jwt}`;
      query.jwt = jwt;
    }

    const socket = io(`${WS_URL}/events`, {
      query,
      extraHeaders: headers,
      reconnection: true,
      reconnectionDelay: 5000,
      reconnectionAttempts: Infinity,
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      // Subscribe to all events for all sessions
      socket.emit('message', {
        type: 'subscribe',
        sessionId: '*',
        events: ['*'],
      });
    });

    socket.on('message', (msg: { type: string; payload?: { event: string; sessionId: string; data: unknown } }) => {
      if (msg.type !== 'event' || !msg.payload) return;
      const { event, data, sessionId } = msg.payload;

      switch (event) {
        case 'session.status': {
          const d = data as { status?: string; name?: string };
          const status = d?.status ?? '';
          const label = STATUS_LABELS[status];
          if (!label) return;
          const name = d?.name || sessionId;
          toastRef.current[label.kind](label.title, name);
          break;
        }
        case 'session.disconnected': {
          const d = data as { name?: string };
          toastRef.current.error('Session déconnectée', d?.name || sessionId);
          break;
        }
        case 'message.received': {
          const d = data as { from?: string; body?: string };
          const from = d?.from?.replace('@c.us', '') ?? '?';
          const preview = d?.body ? d.body.slice(0, 40) : '(média)';
          toastRef.current.info(`Message de ${from}`, preview, );
          break;
        }
        default:
          break;
      }
    });

    // Webhook delivery failures (broadcast, no session context)
    socket.on('webhook:delivery', (payload: { success: boolean; error?: string; webhookId?: string }) => {
      if (!payload.success) {
        toastRef.current.error('Webhook échoué', payload.error ?? payload.webhookId ?? '');
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once — credentials don't change after mount
}
