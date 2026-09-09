import type { Session } from '@supabase/supabase-js';
import { request, NotSignedInError } from '../lib/api';

export type BrokerStatus = {
  connected: boolean;
  broker: 'dhan';
  clientId?: string | null;
  status: 'not_connected' | 'keys_saved' | 'connected' | 'token_invalid' | 'expired' | 'disconnected';
  expiresAt?: string | null;
  daysLeft: number;
  lastError?: string | null;
  liveOk?: boolean | null;
};

function diffDays(iso?: string | null) {
  if (!iso) return 0;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

/**
 * Get broker OAuth status (passive). Safe for Profile screen initial load.
 * Must not throw just because Dhan is not connected.
 */
export async function getBrokerStatus(session: Session | null): Promise<BrokerStatus> {
  const res: any = await request('GET', '/broker/oauth/status', undefined, session?.access_token).catch((e: unknown) => {
    if (e instanceof NotSignedInError) throw e;
    const err = e as Error;
    console.warn('[BrokerStatus] non-fatal:', err?.message || String(err));
    return null;
  });

  const c = res?.credentials;

  if (!c) {
    return {
      connected: false,
      broker: 'dhan',
      clientId: null,
      status: 'not_connected',
      expiresAt: null,
      daysLeft: 0,
      lastError: null,
      liveOk: null,
    };
  }

  const expiresAt = c.access_token_expiry || null;
  const expired = expiresAt ? new Date(expiresAt).getTime() <= Date.now() : false;
  const status = expired ? 'expired' : (c.last_status || 'disconnected');
  const connected = status === 'connected' && !expired && res?.liveCheck?.ok !== false;

  return {
    connected,
    broker: 'dhan',
    clientId: c.dhan_client_id || null,
    status,
    expiresAt,
    daysLeft: diffDays(expiresAt),
    lastError: c.last_error || null,
    liveOk: res?.liveCheck?.ok ?? null,
  };
}

/**
 * Verify broker connection (manual "Test Connection" button only).
 */
export async function verifyBrokerConnection(session: Session | null) {
  return request('POST', '/broker/oauth/verify', {}, session?.access_token);
}
