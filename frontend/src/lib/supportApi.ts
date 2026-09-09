import { getAccessToken } from './authToken';

// ============================================================
// 📋 Support API - JWT-Authenticated
// Uses Supabase Edge Function backend
// ============================================================

// Base URL for edge functions
const API_BASE = 'https://api.indexpilotai.com/functions/v1/make-server-c4d79cb7';

// Supabase anon key
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbGdxZWxjYXVqeG50Z2p5dWlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MTA0NjUsImV4cCI6MjA3NTA4NjQ2NX0.FnFcNQXGXGpsQXvR4TW1LDc23FlIBBglLhZsRdn9VV0';

// Debounce token refresh to prevent multiple simultaneous attempts
let _refreshPromise: Promise<string | null> | null = null;
let _lastRefreshTime = 0;
const REFRESH_COOLDOWN = 5000; // 5 seconds between refresh attempts

async function debouncedRefresh(): Promise<string | null> {
  const now = Date.now();
  if (now - _lastRefreshTime < REFRESH_COOLDOWN) {
    console.log('[SupportAPI] Refresh cooldown active, skipping');
    return null;
  }
  if (_refreshPromise) {
    try {
      return await _refreshPromise;
    } catch {
      return null;
    }
  }
  _lastRefreshTime = now;
  _refreshPromise = (async () => {
    try {
      const { supabase } = await import('./supabase');
      const { data } = await supabase.auth.refreshSession();
      return data?.session?.access_token ?? null;
    } catch (err) {
      console.warn('[SupportAPI] Token refresh failed:', err);
      return null;
    } finally {
      _refreshPromise = null;
    }
  })();
  return _refreshPromise;
}

// Types
export interface SupportAttachment {
  name: string;
  type: string;
  size: number;
  base64: string;
}

export interface TicketAttachment {
  name: string;
  type: string;
  size: number;
  path: string;
  url: string;
}

export interface SupportTicket {
  id: string;
  ticketId?: string;
  ticket_id?: string;
  subject: string;
  message: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  priority?: string;
  category: 'general' | 'trading' | 'billing' | 'technical';
  status: 'PENDING' | 'REPLIED' | 'CLOSED';
  createdAt: string;
  created_at?: string;
  repliedAt: string | null;
  adminReply: string | null;
  replyAttachments: TicketAttachment[];
  attachments: TicketAttachment[];
  unread: boolean;
  hasNewReply?: boolean;
}

export interface CreateTicketParams {
  subject: string;
  message: string;
  urgency?: 'LOW' | 'MEDIUM' | 'HIGH';
  category?: 'general' | 'trading' | 'billing' | 'technical';
  attachments?: SupportAttachment[];
}

// ============================================================
// 🔑 Internal API helper
// ============================================================

async function apiRequest<T = any>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'DELETE' | 'PUT';
    body?: Record<string, any>;
  } = {}
): Promise<T> {
  const { method = 'GET', body } = options;

  // Robust token retrieval: cached token → supabase session → refresh → storage
  const userToken = await getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userToken || SUPABASE_ANON_KEY}`,
    'apikey': SUPABASE_ANON_KEY,
  };

  try {
    let res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Handle 401 → debounced refresh → retry once
    if (res.status === 401) {
      console.log('[SupportAPI] 401 - attempting token refresh');
      const newToken = await debouncedRefresh();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        res = await fetch(`${API_BASE}${path}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });
      } else {
        throw new Error('Session expired. Please sign in again.');
      }
    }

    const json = await res.json().catch(() => ({}));

    if (!res.ok || json.success === false) {
      throw new Error(json.message || json.error || `Request failed (${res.status})`);
    }

    return json as T;
  } catch (err: any) {
    console.warn('[SupportAPI]', path, 'error:', err.message);
    throw err;
  }
}

// ============================================================
// 📡 Public API Methods
// ============================================================

/**
 * Create a new support ticket with optional attachments
 * POST /support/create
 */
export async function createSupportTicket(params: CreateTicketParams): Promise<{ success: boolean; ticketId: string }> {
  return apiRequest('/support/create', {
    method: 'POST',
    body: params,
  });
}

/**
 * Get all support tickets for the current user
 * GET /support/tickets
 * Returns list with admin replies and signed URLs
 */
export async function getSupportTickets(): Promise<{ success: boolean; tickets: SupportTicket[] }> {
  return apiRequest('/support/tickets', {
    method: 'GET',
  });
}

/**
 * Mark a ticket as read (after viewing admin reply)
 * POST /support/mark-read/:ticketId
 */
export async function markTicketRead(ticketId: string): Promise<{ success: boolean }> {
  return apiRequest(`/support/mark-read/${ticketId}`, {
    method: 'POST',
  });
}

export default {
  createTicket: createSupportTicket,
  getTickets: getSupportTickets,
  markRead: markTicketRead,
};
