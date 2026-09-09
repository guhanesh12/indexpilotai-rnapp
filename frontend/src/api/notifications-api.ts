/**
 * Notifications API — exact fetch helper from the prompt spec.
 * 
 * Base:     https://oklgqelcaujxntgjyuis.supabase.co/functions/v1/make-server-c4d79cb7
 * Anon key: VITE_SUPABASE_PUBLISHABLE_KEY (sent as `apikey` header on EVERY call)
 * Auth:     supabase JWT (session.access_token) as `Authorization: Bearer <token>`
 * 
 * Notification shape (server → client):
 *   Server stores: { id, type, title, body, read, created_at, channel, data }
 *   Client maps:   { id, type, title, message (←body), timestamp (←created_at as ms), read, data }
 *   This is because the prompt expects `message` and `timestamp` on the client side.
 */
import { supabase } from '../lib/supabase';

// Direct Supabase Edge Function URL (no custom domain — matches prompt exactly)
const API = 'https://oklgqelcaujxntgjyuis.supabase.co/functions/v1/make-server-c4d79cb7';

// Supabase anon key — sent as `apikey` header on every call
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbGdxZWxjYXVqeG50Z2p5dWlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MTA0NjUsImV4cCI6MjA3NTA4NjQ2NX0.FnFcNQXGXGpsQXvR4TW1LDc23FlIBBglLhZsRdn9VV0';

/** Expected shape from the server (before mapping) */
interface ServerNotification {
  id: string;
  type?: string;
  title: string;
  body?: string;
  message?: string;
  read: boolean;
  created_at?: string;     // ISO string from Supabase
  timestamp?: number;       // ms — server may already send ms
  channel?: string;
  data?: Record<string, any>;
}

/** Client-side notification shape matching the prompt spec */
export interface Notification {
  id: string;
  type: string;            // 'SIGNAL_GENERATED' | 'ORDER_PLACED' | 'POSITION_CLOSED_PROFIT' | 'MARKET_OPEN' | ...
  title: string;
  message: string;
  timestamp: number;       // ms
  read: boolean;
  data?: {
    imageUrl?: string;     // render as <Image> if present
    targetUrl?: string;    // deep-link / webview
    symbol?: string;
    pnl?: number;
    price?: number;
    [k: string]: any;
  };
}

// ─────────────────────────────────────────────────────────
// Fetch helper (exact match to prompt spec)
// ─────────────────────────────────────────────────────────
async function api(path: string, init: RequestInit = {}): Promise<any> {
  let session: any = null;
  try {
    const result = await supabase.auth.getSession();
    session = result?.data?.session;
  } catch (e: any) {
    console.log('[NotificationsAPI] Invalid session:', e?.message || e);
    throw new Error('Not signed in');
  }
  if (!session) throw new Error('Not signed in');

  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON,
      'Authorization': `Bearer ${session.access_token}`,
      ...(init.headers || {}),
    },
  });

  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

// ─────────────────────────────────────────────────────────
// Maps a server notification to the client-facing shape
// ─────────────────────────────────────────────────────────
function mapNotification(srv: ServerNotification): Notification {
  return {
    id: srv.id,
    type: srv.type || 'default',
    title: srv.title || '',
    message: srv.body || srv.message || '',
    timestamp: srv.timestamp ?? (srv.created_at ? new Date(srv.created_at).getTime() : Date.now()),
    read: srv.read || false,
    data: srv.data || {},
  };
}

// ─────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────
export const NotificationsAPI = {
  /**
   * List all notifications (last 24 h, auto-trimmed server-side).
   * Returns mapped Notification[].
   */
  async list(): Promise<Notification[]> {
    const json = await api('/user/notifications');
    // Server may wrap in { notifications: [...] } or return array directly
    const raw: ServerNotification[] = json?.notifications ?? json?.data ?? json ?? [];
    return (Array.isArray(raw) ? raw : []).map(mapNotification);
  },

  /** Mark a single notification as read. */
  async markRead(id: string): Promise<void> {
    await api(`/user/notifications/${id}/read`, { method: 'POST' });
  },

  /** Mark all notifications as read. */
  async markAll(): Promise<void> {
    await api('/user/notifications/read-all', { method: 'POST' });
  },

  /** Clear / delete all notifications. */
  async clearAll(): Promise<void> {
    await api('/user/notifications', { method: 'DELETE' });
  },
};
