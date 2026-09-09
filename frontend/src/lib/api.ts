import { Storage } from './storage';
import { parseDhanCSV, filterOptions, DhanInstrument } from './csvParser';
import { getAccessToken } from './authToken';

// Debounce token refresh to prevent multiple simultaneous refresh attempts
let _refreshPromise: Promise<any> | null = null;
let _lastRefreshTime = 0;
const REFRESH_COOLDOWN = 5000; // 5 seconds between refresh attempts

// ─── GLOBAL FETCH TIMEOUT ────────────────────────────────────
// Every network call has a hard upper bound. Without this, a slow/blocked
// network can hang the broker connect flow for 10+ minutes per call.
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;     // 10s for normal calls
const BROKER_FETCH_TIMEOUT_MS = 8_000;       // 8s for broker status polls

/**
 * Wraps a fetch() promise with an AbortController-based timeout.
 * On timeout, the underlying request is aborted so we don't leak sockets.
 */
export async function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Supabase configuration
export const SUPABASE_PROJECT_ID = 'oklgqelcaujxntgjyuis';

// ─── EXCEPTIONS ────────────────────────────────────
export class NotSignedInError extends Error {
  constructor() {
    super('NOT_SIGNED_IN');
    this.name = 'NotSignedInError';
  }
}

// ─── PASSIVE BROKER STATUS (safe for profile load) ──
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

export async function getBrokerOAuthStatus(token?: string | null): Promise<BrokerStatus> {
  // Use the auth-aware request helper
  const res: any = await request('GET', '/broker/oauth/status', undefined, token);
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
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbGdxZWxjYXVqeG50Z2p5dWlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MTA0NjUsImV4cCI6MjA3NTA4NjQ2NX0.FnFcNQXGXGpsQXvR4TW1LDc23FlIBBglLhZsRdn9VV0';

// ============================================================
// 🔑 API CONFIG (Task Requirements - Verified Live)
// ============================================================
// Direct Supabase Edge Function URL - no custom domain needed
export const API_BASE = 'https://api.indexpilotai.com/functions/v1/make-server-c4d79cb7';

// Custom domain URL for ALL Supabase Edge Function API calls
const API_BASE_URL = API_BASE;

// Headers for every JSON API call
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'apikey': SUPABASE_ANON_KEY,
};

// Development flag for debug logging
const IS_DEV = __DEV__ || process.env.NODE_ENV === 'development';

/**
 * Reusable API POST helper
 * @param path - API endpoint path (e.g., "/auth/check-email")
 * @param body - Request body object
 * @returns JSON response from API
 * @throws Error with backend message if request fails
 */
async function apiPost<T = any>(path: string, body: any): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || data.message || `API Error ${res.status}`);
  }

  // Debug logging only in development
  if (IS_DEV) {
    console.log('API:', path, data);
  }

  return data as T;
}

// Legacy BASE_URL for backward compatibility
const BASE_URL = API_BASE_URL;

// ============================================================
// 📡 REUSABLE API CLIENT (Task Requirement C)
// ============================================================
/**
 * Reusable api client with user JWT authentication and 401 handling.
 * Uses exactly the config from task requirements.
 * Named fetchApi to avoid conflict with the existing api object export.
 */
// Debounced token refresh helper
async function debouncedRefresh(): Promise<string | null> {
  const now = Date.now();
  
  // If we refreshed recently, skip
  if (now - _lastRefreshTime < REFRESH_COOLDOWN) {
    console.log('[API] Refresh cooldown active, skipping');
    return null;
  }
  
  // If a refresh is already in progress, wait for it
  if (_refreshPromise) {
    console.log('[API] Refresh already in progress, waiting...');
    try {
      const result = await _refreshPromise;
      return result?.access_token ?? null;
    } catch {
      return null;
    }
  }
  
  _lastRefreshTime = now;
  _refreshPromise = (async () => {
    try {
      const { supabase } = await import('./supabase');
      const { data } = await supabase.auth.refreshSession();
      return data?.session;
    } catch (err) {
      console.warn('[API] Token refresh failed:', err);
      return null;
    } finally {
      _refreshPromise = null;
    }
  })();
  
  const session = await _refreshPromise;
  return session?.access_token ?? null;
}

export async function fetchApi(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'DELETE' | 'PUT';
    body?: Record<string, any>;
    token?: string | null;
  } = {}
): Promise<any> {
  const { method = 'GET', body, token } = options;
  
  // Use provided token or get from auth token helper (checks cached token first)
  const userToken = token ?? await getAccessToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userToken || SUPABASE_ANON_KEY}`,
    'apikey': SUPABASE_ANON_KEY,
  };

  try {
    const res = await fetchWithTimeout(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Handle 401 -> debounced refresh -> retry once
    if (res.status === 401) {
      console.log('[API] 401 - attempting debounced token refresh');
      const newToken = await debouncedRefresh();
      if (newToken) {
        // Retry with new token
        headers['Authorization'] = `Bearer ${newToken}`;
        const retryRes = await fetchWithTimeout(`${API_BASE}${path}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!retryRes.ok) {
          const error = await retryRes.json().catch(() => ({}));
          throw new Error(error?.error || `HTTP ${retryRes.status}`);
        }
        return await retryRes.json();
      } else {
        throw new Error('Session expired. Please sign in again.');
      }
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      console.warn('[API]', path, res.status);
      throw new Error(error?.error || error?.message || `HTTP ${res.status}`);
    }

    return await res.json();
  } catch (err: any) {
    console.warn('[API]', path, 'error:', err.message);
    throw err;
  }
}

// ============================================================
// 📡 NEW ENDPOINTS FOR FEATURES A, B
// ============================================================

// Task A: Intraday OHLC (Home screen chart)
export const intradayApi = {
  /**
   * Get intraday OHLC data for indices
   * POST /intraday-ohlc
   * securityId: "13" (NIFTY), "25" (BANKNIFTY), "51" (SENSEX)
   */
  getOhlc: (params: {
    securityId: string;
    exchangeSegment?: string;
    instrument?: string;
    interval?: string;
    includeOI?: boolean;
}) => fetchApi('/intraday-ohlc', { method: 'POST', body: params }),
};

// ─── Helpers for correct exit order payload ─────────────────
function buildExitPayload(position: { symbol_id?: string; security_id?: string; exchange_segment?: string; quantity?: number; trading_symbol?: string; symbol?: string; index_name?: string; order_id?: string }) {
  const correlationId = `RN_EXIT_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const securityId = position.symbol_id || position.security_id;
  const quantity = Math.max(1, Number(position.quantity || 0));
  
  return {
    correlationId,
    transactionType: "SELL",
    exchangeSegment: position.exchange_segment || "NSE_FNO",
    productType: "INTRADAY",
    orderType: "MARKET",
    validity: "DAY",
    securityId: String(securityId),
    quantity,
    disclosedQuantity: 0,
    price: 0,
    triggerPrice: 0,
    afterMarketOrder: false,
    amoTime: "",
    boProfitValue: 0,
    boStopLossValue: 0,
    symbolName: position.trading_symbol || position.symbol || "",
    index: position.index_name || "",
  };
}

function mapExitError(errMsg: string): string {
  if (!errMsg) return "Exit order failed";
  if (errMsg.includes("credentials not configured")) {
    return "Credentials not configured — Please connect your broker first.";
  }
  if (errMsg.includes("IP_WHITELIST")) {
    return "IP whitelist pending — Please whitelist the VPS IP in your broker account.";
  }
  if (errMsg.includes("TOKEN_EXPIRED") || errMsg.includes("token expired")) {
    return "Access token expired — Please reconnect your broker.";
  }
  if (errMsg.includes("OUTDATED_VPS")) {
    return "VPS server needs update — Please contact support.";
  }
  if (errMsg.includes("Unauthorized") || errMsg.includes("401")) {
    return "Session expired — Please login again.";
  }
  return errMsg;
}

// Task B: Position Monitor
export const positionMonitorApi = {
  /**
   * Get active monitored positions (poll every 2s)
   * GET /position-monitor/list
   */
  getList: () => fetchApi('/position-monitor/list', { method: 'GET' }),
  
  /**
   * Get all positions (Dhan day book)
   * GET /positions
   */
getAll: () => fetchApi('/positions', { method: 'GET' }),
  
  /**
   * Exit position using correct endpoint: /execute-dhan-order with SELL MARKET order
   * Uses Supabase JWT auth — no userId in body
   * Matches website behavior exactly
   */
  exitPosition: async (position: { symbol_id?: string; security_id?: string; exchange_segment?: string; quantity?: number; trading_symbol?: string; symbol?: string; index_name?: string; order_id?: string }) => {
    if (!position?.order_id) throw new Error("Missing position order id");
    if (!(position.symbol_id || position.security_id)) throw new Error("Missing security id for exit order");
    if (!Number(position?.quantity)) throw new Error("Missing quantity for exit order");

    const payload = buildExitPayload(position);
    
    try {
      const result = await fetchApi('/execute-dhan-order', { method: 'POST', body: payload });
      if (!result?.success && !result?.orderId) {
        throw new Error(result?.error || result?.message || "Exit order failed");
      }
      return result;
    } catch (err: any) {
      const userMsg = mapExitError(err.message);
      throw new Error(userMsg);
    }
  },

  /**
   * Exit multiple positions sequentially (batch exit)
   * POST /execute-dhan-order for each position — SELL MARKET
   * Returns summary of successful/failed exits
   */
  exitPositionsBatch: async (positions: Array<{ symbol_id?: string; security_id?: string; exchange_segment?: string; quantity?: number; trading_symbol?: string; symbol?: string; index_name?: string; order_id?: string }>): Promise<{ successful: number; failed: number; results: Array<{ symbol: string; success: boolean; orderId?: string; error?: string }> }> => {
    const results: Array<{ symbol: string; success: boolean; orderId?: string; error?: string }> = [];
    let successful = 0;
    let failed = 0;

    for (const pos of positions) {
      try {
        if (!pos?.order_id) {
          failed++;
          results.push({ symbol: pos.trading_symbol || pos.symbol || "Unknown", success: false, error: "Missing order id" });
          continue;
        }
        if (!(pos.symbol_id || pos.security_id)) {
          failed++;
          results.push({ symbol: pos.trading_symbol || pos.symbol || "Unknown", success: false, error: "Missing security id" });
          continue;
        }
        if (!Number(pos?.quantity)) {
          failed++;
          results.push({ symbol: pos.trading_symbol || pos.symbol || "Unknown", success: false, error: "Missing quantity" });
          continue;
        }

        const payload = buildExitPayload(pos);
        const result = await fetchApi('/execute-dhan-order', { method: 'POST', body: payload });
        
        if (result?.success || result?.orderId) {
          successful++;
          results.push({ symbol: pos.trading_symbol || pos.symbol || "Unknown", success: true, orderId: result.orderId });
        } else {
          failed++;
          results.push({ symbol: pos.trading_symbol || pos.symbol || "Unknown", success: false, error: mapExitError(result?.error || result?.message || "Exit order failed") });
        }
      } catch (err: any) {
        failed++;
        results.push({ symbol: pos.trading_symbol || pos.symbol || "Unknown", success: false, error: mapExitError(err.message) });
      }
    }

    return { successful, failed, results };
  },
  
  /**
   * Update trailing settings
   * POST /position-monitor/trailing
   */
  updateTrailing: (params: {
    orderId: string;
    trailingEnabled: boolean;
    trailingStep: number;
}) => fetchApi('/position-monitor/trailing', { method: 'POST', body: params }),
};

// Task: Engine Status (optional)
export const engineApi = {
  getDbStatus: () => fetchApi('/engine/db-status', { method: 'GET' }),
  getStatus: () => fetchApi('/engine/status', { method: 'GET' }),
};

// Task: Notifications
export const notificationApi = {
  getAll: () => fetchApi('/user/notifications', { method: 'GET' }),
  markRead: (id: string) => fetchApi(`/user/notifications/${id}/read`, { method: 'POST', body: {} }),
  markAllRead: () => fetchApi('/user/notifications/read-all', { method: 'POST', body: {} }),
};

export async function request<T = any>(
  method: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH',
  endpoint: string,
  body?: any,
  overrideToken?: string | null
): Promise<T> {
  let sessionToken = overrideToken ?? await getAccessToken();

  if (!sessionToken) {
    throw new NotSignedInError();
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${sessionToken}`,
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  };

  const doFetch = (token: string) =>
    fetchWithTimeout(`${BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    }, DEFAULT_FETCH_TIMEOUT_MS);

  let res = await doFetch(sessionToken);

  // Auto-refresh on 401 and retry once (using debounced refresh)
  if (res.status === 401) {
    const newToken = await debouncedRefresh();
    if (newToken) {
      sessionToken = newToken;
      res = await doFetch(newToken);
    }
  }

  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const msg = data?.error || data?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return data as T;
}

// Backend auth - uses MongoDB-based authentication (bypasses Supabase)
async function backendLogin(email: string, password: string) {
  // Supabase auth works - use it directly
  const SUPABASE_URL = 'https://oklgqelcaujxntgjyuis.supabase.co';
  
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ email, password }),
  });
    
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  
  if (!res.ok) {
    // Handle specific error messages with user-friendly text
    const msg = data?.error || data?.message || `Login failed (${res.status})`;
    
    // Map technical errors to user-friendly messages
    if (msg.includes('Invalid API key') || msg.includes('API key')) {
      throw new Error('Server configuration error. Please contact support.');
    }
    if (msg.includes('invalid') || msg.includes('credentials')) {
      throw new Error('Invalid email or password');
    }
    throw new Error(msg);
  }
  
  // Return standardized response - ensure access_token exists
  if (!data?.access_token && !data?.token) {
    throw new Error('Invalid response from server');
  }
  
  return {
    access_token: data?.access_token || data?.token || null,
    refresh_token: data?.refresh_token || data?.access_token || null,
    user: data?.user || { email },
  };
}

async function sbAuth(pathWithQuery: string, body: any) {
  const SUPABASE_URL = 'https://oklgqelcaujxntgjyuis.supabase.co';
  const res = await fetch(`${SUPABASE_URL}/auth/v1${pathWithQuery}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data?.error_description || data?.msg || data?.error || `Auth failed (${res.status})`;
    throw new Error(msg);
  }
  
  // Ensure the response has the expected access_token format for login
  // Fix: Make sure we return an object with accessible properties
  if (pathWithQuery.includes('grant_type=password')) {
    // For password login, ensure we have the correct token structure
    return {
      access_token: data?.access_token || null,
      refresh_token: data?.refresh_token || data?.access_token || null,
      expires_in: data?.expires_in || 3600,
      token_type: data?.token_type || 'bearer',
      user: data?.user || { id: data?.user_id, email: body?.email },
      userId: data?.user_id,
    };
  }
  
  return data;
}

export const api = {
// ─── AUTH ──────────────────────────────────────
  loginWithPassword: (email: string, password: string) =>
    backendLogin(email, password),
  refreshSession: (refresh_token: string) =>
    sbAuth('/token?grant_type=refresh_token', { refresh_token }),
  forgotPassword: (email: string) => request('POST', '/auth/forgot-password', { email }),
  
  // ─── SIGNUP FLOW (Using exact endpoints) ─────────
  /**
   * Step 1: Check if email exists
   * POST /auth/check-email
   * Body: { email }
   * Response: { exists: boolean }
   */
  checkEmail: (email: string) => apiPost('/auth/check-email', { email }),
  
  /**
   * Step 2: Send email OTP for verification
   * POST /auth/email-otp/send
   * Body: { email, name }
   */
  emailOtpSend: (email: string, name: string) => 
    apiPost('/auth/email-otp/send', { email, name }),
  
  /**
   * Step 3: Verify email OTP
   * POST /auth/email-otp/verify
   * Body: { email, otp }
   */
  emailOtpVerify: (email: string, otp: string) => 
    apiPost('/auth/email-otp/verify', { email, otp }),
  
  /**
   * Step 4: Send mobile OTP
   * POST /auth/send-otp
   * Body: { phone, email, name }
   * phone must be only 10 digits, no +91
   */
  sendOtp: (phone: string, email: string, name: string) => 
    apiPost('/auth/send-otp', { phone, email, name }),
  
  /**
   * Step 5: Verify mobile OTP
   * POST /auth/verify-otp
   * Body: { phone, otp }
   * IMPORTANT: Does NOT pass email/password/name
   */
  verifyOtp: (phone: string, otp: string) => 
    apiPost('/auth/verify-otp', { phone, otp }),
  
  /**
   * Step 6: Create account (direct registration)
   * POST /auth/register-direct
   * Body: { email, password, name, phone, referredBy }
   * Returns: { success, user, session: { access_token, refresh_token } }
   */
  registerDirect: (data: {
    email: string;
    password: string;
    name: string;
    phone: string;
    referredBy?: string;
  }) => apiPost('/auth/register-direct', data),
  
  // ─── FORGOT PASSWORD FLOW (Using exact endpoints) ──
  /**
   * Step 1: Send reset OTP (forgot password)
   * POST /auth/forgot-password
   * Body: { email, phone }
   * If email and phone do not match, show backend error
   */
  forgotPasswordSendOtp: (email: string, phone: string) => 
    apiPost('/auth/forgot-password', { email, phone }),
  
  /**
   * Step 2: Reset password
   * POST /auth/reset-password
   * Body: { phone, otp, newPassword }
   */
  forgotPasswordReset: (phone: string, otp: string, newPassword: string) =>
    apiPost('/auth/reset-password', { phone, otp, newPassword }),
  
  // Legacy aliases for backwards compatibility
  forgotPasswordVerifyIdentity: (email: string, mobile: string) => 
    apiPost('/auth/forgot-password', { email, phone: mobile }),
  forgotPasswordResetWithUserId: (userId: string, newPassword: string) =>
    request('POST', '/auth/forgot-password', { userId, newPassword }),
  
// ─── PROFILE ────────────────────────────────────
  // Create profile (uses service role key via backend)
  createProfile: (userId: string, data: { email: string; full_name?: string; mobile?: string }) =>
    request('POST', '/profiles/create-profile', { user_id: userId, ...data }),

  // ─── WELCOME BONUS PROFILE (Task Feature 2) ─────────────────────────────
  /**
   * Get current user's profile including bonus info
   * GET /profile/me
   * Response: {
   *   profile: {
   *     welcome_popup_seen: boolean,
   *     signup_bonus_amount: number,
   *     signup_bonus_remaining: number,
   *     signup_bonus_expires_at: "2026-06-28T..."
   *   },
   *   referralCode: "...",
   *   earnings: { ... }
   * }
   */
  getProfileMe: () => request('GET', '/profile/me'),

  /**
   * Update profile (e.g., mark welcome popup as seen)
   * PATCH /profile/me
   * Body: { welcome_popup_seen: true }
   */
  updateProfileMe: (data: { welcome_popup_seen?: boolean }) =>
    request('PATCH', '/profile/me', data),

  // ─── SYMBOLS ───────────────────────────────────
  getSymbols: () => request('GET', '/symbols/get'),
  saveSymbols: (symbols: any[]) => request('POST', '/symbols/save', { symbols }),
  saveSymbol: (symbol: any) => request('POST', '/symbols/save', { symbols: [symbol] }),
  deleteSymbol: (id: string) => request('POST', '/symbols/save', { action: 'delete', id }),
  searchInstruments: (query: string, segment: string = 'NSE_FNO') =>
    request('POST', '/search-option', { query, segment }),
  downloadSymbolsCSV: async (forceDownload = false) => {
    try {
      console.log('[API] downloadSymbolsCSV force=', forceDownload);
      // Check chunked cache first (7 days validity)
      if (!forceDownload) {
        const cached = await Storage.getInstrumentsChunked();
        if (cached.data.NIFTY.length > 0 && cached.isFresh !== false) {
          console.log('[API] Cache hit:', cached.total, cached.counts);
          return cached;
        }
      }
      console.log('[API] Cache miss/stale - downloading fresh');

      // Clear any old/incomplete chunks
      await Storage.clearInstruments();

      // Download fresh CSV
      const res = await fetch('https://images.dhan.co/api-data/api-scrip-master-detailed.csv');
      if (!res.ok) throw new Error(`CSV download failed: ${res.status}`);
      const csvText = await res.text();
      const lines = csvText.trim().split('\n');
      console.log('[API] CSV downloaded:', csvText.length, 'bytes,', lines.length, 'lines');

      // Parse and filter
      const instruments: DhanInstrument[] = parseDhanCSV(csvText);
      const bundle = filterOptions(instruments);
      const total = Object.values(bundle).reduce((sum: number, idx: any[]) => sum + idx.length, 0);
      const counts = {
        NIFTY: bundle.NIFTY.length,
        BANKNIFTY: bundle.BANKNIFTY.length,
        SENSEX: bundle.SENSEX.length,
      };
      console.log('[API] Parsed', instruments.length, 'inst → bundle total', total, 'counts', counts);

      // Cache with chunks (NEW)
      await Storage.saveInstrumentsChunked(bundle);

      return { instruments: bundle, total, counts, success: true };
    } catch (error: any) {
      console.error('[API ERROR] downloadSymbolsCSV:', error);
      throw new Error(`Download failed: ${error.message}`);
    }
  },

// ─── ORDERS / TRADING ──────────────────────────
  executeOrder: async (p: any) => {
    const result = await request('POST', '/execute-dhan-order', p);
    // Auto-send push notification after order executed
    if (result?.success || result?.orderId) {
      try {
        const fcmToken = await Storage.getFcmToken();
        await request('POST', '/push/send/order', {
          token: fcmToken,
          title: "✅ Order Executed",
          body: `${p.symbol || 'Your'} order has been executed at ₹${p.price || 'market'}`,
          channel: "orders"
        });
      } catch {}
    }
    return result;
  },
placeOrder: async (p: any) => {
    const result = await request('POST', '/place-order', p);
    // Auto-send push notification after order placed
    if (result?.success || result?.orderId) {
      try {
        const fcmToken = await Storage.getFcmToken();
        await request('POST', '/push/send/order', {
          token: fcmToken,
          title: "📝 Order Placed",
          body: `${p.symbol || 'Your'} order placed for ${p.quantity} shares @ ₹${p.price}`,
          channel: "orders"
        });
      } catch {}
    }
    return result;
  },
executeTrade: async (p: any) => {
    const result = await request('POST', '/execute-trade', p);
    // Auto-send push notification after trade executed
    if (result?.success) {
      try {
        const fcmToken = await Storage.getFcmToken();
        await request('POST', '/push/send/order', {
          token: fcmToken,
          title: "🎯 Trade Executed",
          body: `Trade executed: ${p.action} ${p.symbol} @ ₹${p.price}`,
          channel: "orders"
        });
      } catch {}
    }
    return result;
  },
exitPosition: async (p: any) => {
    const result = await request('POST', '/exit-position', p);
    // Auto-send push notification after position exited
    if (result?.success) {
      try {
        const fcmToken = await Storage.getFcmToken();
        await request('POST', '/push/send/order', {
          token: fcmToken,
          title: "🔄 Position Exited",
          body: `${p.symbol || 'Position'} exited at ₹${p.exitPrice || 'market'}`,
          channel: "orders"
        });
      } catch {}
    }
    return result;
  },

  // ─── POSITIONS ─────────────────────────────────
  getLivePositions: () => request('GET', '/live-positions'),
  getPositions: () => request('GET', '/positions'),
  /** Active position monitor (per IndexPilotAI_PositionMonitor_API.md) */
  getMonitorActive: () => request('GET', '/positions/monitor/active'),

  // ─── JOURNAL ───────────────────────────────────
  getJournal: (p?: any) => request('POST', '/get-journal-entries', p || { limit: 100 }),
  addJournal: (p: any) => request('POST', '/add-journal-entry', p),
  clearJournal: () => request('POST', '/clear-journal-data', {}),

// ─── STRATEGY / AI ─────────────────────────────
getAISignal: async (p: { index: string; interval: string; accountBalance?: number }) => {
    const result = await request('POST', '/advanced-ai-signal', p);
    // Auto-send push notification when new signal is generated
    if (result?.success && result?.signal) {
      try {
        const fcmToken = await Storage.getFcmToken();
        await request('POST', '/push/send/signal', {
          token: fcmToken,
          title: "📈 New AI Signal",
          body: `${p.index} (${p.interval}): ${result.signal.action} @ ₹${result.signal.entry}`,
          channel: "signals"
        });
      } catch {}
    }
    return result;
  },
  monitorPosition: (p: any) => request('POST', '/monitor-position', p),
  aiAnalysis: (p: any) => request('POST', '/ai-analysis', p),

// ─── SUPPORT ───────────────────────────────────
createTicket: async (p: any) => {
    const result = await request('POST', '/support/create', p);
    // Auto-send push notification when ticket is created
    if (result?.success || result?.ticketId) {
      try {
        const fcmToken = await Storage.getFcmToken();
        await request('POST', '/push/send/ticket', {
          token: fcmToken,
          title: "🎫 Ticket Created",
          body: `Your support ticket #${result.ticketId || ''} has been created`,
          channel: "default"
        });
      } catch {}
    }
    return result;
  },
  getTickets: () => request('GET', '/support/tickets'),
  markTicketRead: (ticketId: string) => request('POST', `/support/mark-read/${ticketId}`, {}),

  // ─── PUSH NOTIFICATIONS (FCM/APNs) ─────────────
  subscribePush: (token: string, platform: 'android' | 'ios', userId?: string) =>
    request('POST', '/push/subscribe', { deviceToken: token, platform, userId }),
  getNotifications: () => request('GET', '/user/notifications'),
  markNotificationRead: (id: string) => request('POST', `/user/notifications/${id}/read`, {}),
  markAllNotificationsRead: () => request('POST', '/user/notifications/read-all', {}),
  clearNotifications: () => request('DELETE', '/user/notifications'),

  // ─── LOGS ──────────────────────────────────────
  getLogs: () => request('GET', '/logs'),
  addLog: (p: any) => request('POST', '/logs', p),
  clearLogs: () => request('DELETE', '/logs'),

  // ─── BROKER ────────────────────────────────────
  getApiCredentials: () => request('GET', '/api-credentials'),
  saveApiCredentials: (dhanClientId: string, dhanAccessToken: string) =>
    request('POST', '/api-credentials', { dhanClientId, dhanAccessToken }),
  /** 2-step sync flow per docs: 1) save clientId only, 2) update token. Both app & website see status. */
  saveDhanClientId: (dhanClientId: string) =>
    request('POST', '/api-credentials', { dhanClientId }),
  updateAccessToken: (dhanAccessToken: string) =>
    request('POST', '/update-access-token', { dhanAccessToken }),
  testApiConnection: () => request('POST', '/test-api-connection', {}),
  testConnection: () => request('POST', '/check-vps-connectivity', {}),
  getFundLimits: () => request('GET', '/fund-limits'),
  /** Direct Dhan API test — bypasses Supabase proxy (which has bugs in the user's deployment). */
  // testDhanDirect removed - backend handles verification

// ─── WALLET ────────────────────────────────────
  getWalletBalance: () => request('GET', '/wallet/balance'),
  getWalletTransactions: () => request('GET', '/wallet/transactions'),
  getWalletDailyStats: () => request('GET', '/wallet/daily-stats'),
  initWallet: () => request('POST', '/wallet/initialize', {}),
createRecharge: async (amount: number) => {
    const result = await request('POST', '/wallet/create-recharge-order', { amount });
    // Auto-send push notification after recharge created
    if (result?.orderId) {
      try {
        const fcmToken = await Storage.getFcmToken();
        await request('POST', '/push/send/alert', {
          token: fcmToken,
          title: "💰 Recharge Initiated",
          body: `Recharge of ₹${amount} initiated. Please complete payment.`,
          channel: "wallet"
        });
      } catch {}
    }
    return result;
  },
verifyRecharge: async (p: any) => {
    const result = await request('POST', '/wallet/verify-payment', p);
    // Auto-send push notification after recharge verified
    if (result?.success) {
      try {
        const fcmToken = await Storage.getFcmToken();
        await request('POST', '/push/send/alert', {
          token: fcmToken,
          title: "✅ Recharge Successful",
          body: `₹${p.amount || 'Your'} wallet has been recharged successfully!`,
          channel: "wallet"
        });
      } catch {}
    }
    return result;
  },

  // ─── STATIC IP / DEDICATED VPS ─────────────────
  getMyIP: () => request('POST', '/ip-pool/my-ip', {}),
  createIPOrder: () => request('POST', '/ip-pool/create-payment-order', {}),
  cancelIP: () => request('POST', '/ip-pool/cancel', {}),
  getIPStatus: () => request('POST', '/ip-pool/provisioning-status', {}),
  /** Wallet purchase / renewal for dedicated VPS (₹599) */
  subscribeIP: () => request('POST', '/ip-pool/subscribe', { autoProvision: true }),
  /** Verify Razorpay payment and start provisioning */
  verifyIPPayment: (p: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
    request('POST', '/ip-pool/verify-payment-and-provision', p),
  /** Cancel a stuck provisioning job (no charge) */
  cancelIPProvisioning: () => request('POST', '/ip-pool/provisioning-cancel', {}),
  /** Restart a failed provisioning job (no re-charge) */
  restartIPProvisioning: () => request('POST', '/ip-pool/provisioning-restart', {}),
  /** Recreate the droplet (IP changes, expiry preserved, no payment) */
  recreateIP: () => request('POST', '/ip-pool/recreate', {}),
  /** Recover / link an existing VPS */
  recoverIP: () => request('POST', '/ip-pool/my-ip', {}),
  /** VPS power status (auto on/off on trading days) */
  getVpsPowerStatus: () => request('GET', '/vps-power/my-status'),
  /** Test VPS connectivity */
  testVpsConnectivity: () => request('GET', '/check-vps-connectivity'),
  /** Shared static IP status (₹59) */
  getStaticIpStatus: () => request('GET', '/wallet/static-ip-status'),
  /** Shared static IP auto-debit check */
  checkStaticIpSubscription: () => request('POST', '/wallet/static-ip-subscription-check', {}),
  /** Update user activity (feeds 10-day inactivity rule) */
  updateUserActivity: () => request('POST', '/user/update-activity', {}),

// ─── ENGINE ────────────────────────────────────
  // Engine - UI polling (direct backend state)
  getEngineStatusAll: () => request('GET', '/engine/status/all'),
  getEngineStatus: (interval: string) => request('GET', `/engine/status?candleInterval=${interval}`),
  getEngineDbStatus: () => request('GET', '/engine/db-status'),

  // Engine - HARD backend actions (Force Stop only)
  startEngine: (interval: string, symbols: any[] = []) =>
    request('POST', '/engine/start', { candleInterval: interval, symbols }),
  stopEngine: () => request('POST', '/engine/stop', {}),
  forceStopEngine: (interval: string) =>
    request('POST', '/engine/stop', { candleInterval: interval }),

  // Legacy (still works)
  setEngineState: (patch: any) => request('POST', '/engine/state', patch),

  // ─── DHAN DIRECT ────────────────────────────────
  /** Direct Dhan API test — bypasses Supabase proxy (which has bugs in the user's deployment). */
  testDhanDirect: (clientId: string, accessToken: string) =>
    request('POST', '/test-dhan-direct', { clientId, accessToken }),


// ─── MARKET ────────────────────────────────────
  getMarketQuote: (p: any) => request('POST', '/market-quote', p),
  getOhlc: (p: any) => request('POST', '/ohlc-data', p),

// ─── DHAN OAUTH (Automatic Token Generation) ───────
  /**
   * Step 1: Generate consent - Get consentAppId from Dhan
   * POST /dhan/generate-consent
   * Body: { clientId, apiKey, apiSecret }
   * Response: { consentAppId, consentAppStatus }
   */
  generateDhanConsent: (p: { clientId: string; apiKey: string; apiSecret: string }) =>
    request('POST', '/dhan/generate-consent', p),

  /**
   * Step 3: Consume consent - Exchange tokenId for accessToken
   * POST /dhan/consume-consent
   * Body: { tokenId, apiKey, apiSecret }
   * Response: { accessToken, expiryTime, dhanClientId }
   */
  consumeDhanConsent: (p: { tokenId: string; apiKey: string; apiSecret: string }) =>
    request('POST', '/dhan/consume-consent', p),

  // ─── SECURITY ENDPOINTS ────────────────────────────────
  /**
   * Generate a new CAPTCHA challenge
   * GET /security/captcha
   * Response: { captcha_id, question }
   */
  getCaptcha: () => request('GET', '/security/captcha'),

  /**
   * Verify CAPTCHA answer
   * POST /security/captcha/verify
   * Body: { captcha_id, answer }
   * Response: { success: boolean }
   */
  verifyCaptcha: (captchaId: string, answer: string) =>
    request('POST', '/security/captcha/verify', { captcha_id: captchaId, answer }),

  /**
   * Validate email domain (check if disposable email)
   * POST /security/validate-email
   * Body: { email }
   * Response: { blocked: boolean, reason?: string }
   */
  validateEmail: (email: string) =>
    request('POST', '/security/validate-email', { email }),

  /**
   * Validate password strength
   * POST /security/validate-password
   * Body: { password }
   * Response: { valid: boolean, reason?: string }
   */
  validatePassword: (password: string) =>
    request('POST', '/security/validate-password', { password }),

  /**
   * Get security status (admin endpoint)
   * GET /security/status
   * Response: { blocked_ips, rate_limits, failed_logins, security_events_count, recent_events }
   */
  getSecurityStatus: () => request('GET', '/security/status'),

  /**
   * Block an IP (admin endpoint)
   * POST /security/block-ip
   * Body: { ip, reason }
   */
  blockIp: (ip: string, reason: string) =>
    request('POST', '/security/block-ip', { ip, reason }),

  /**
   * Unblock an IP (admin endpoint)
   * POST /security/unblock-ip
   * Body: { ip }
   */
  unblockIp: (ip: string) =>
    request('POST', '/security/unblock-ip', { ip }),

  /**
   * Get security events
   * GET /security/events
   */
  getSecurityEvents: () => request('GET', '/security/events'),

  // ─── AUTO SYMBOL (Task Requirement) ───────────────
  /**
   * Get auto-symbol configuration
   * GET /auto-symbol/config
   * Response: { success, slots, max_slots, free_slots, extra_slots, slot_price, hard_cap, slot[]... }
   */
  getAutoSymbolConfig: () => request('GET', '/auto-symbol/config'),

  /**
   * Purchase one extra auto-symbol slot (₹49)
   * POST /auto-symbol/purchase-slot
   * No body.
   */
  purchaseExtraSlot: () => request('POST', '/auto-symbol/purchase-slot', {}),

  /**
   * Save/update auto-symbol slot with risk management
   * POST /auto-symbol/config
   * Body: Slot fields:
   * { slot, index_name, moneyness, lot_count, enabled,
   *   target_per_lot, stop_loss_per_lot, trailing_enabled,
   *   trailing_activation_per_lot, trailing_step_per_lot }
   */
  saveAutoSymbolSlot: (p: {
    slot: number;
    index_name: string;
    moneyness: string;
    lot_count: number;
    enabled: boolean;
    target_per_lot: number;
    stop_loss_per_lot: number;
    trailing_enabled: boolean;
    trailing_activation_per_lot: number;
    trailing_step_per_lot: number;
  }) => request('POST', '/auto-symbol/config', p),

  /**
   * Delete auto-symbol slot
   * DELETE /auto-symbol/config/:slot
   */
  deleteAutoSymbolSlot: (slot: number) => request('DELETE', `/auto-symbol/config/${slot}`),

  /**
   * Resolve auto-symbol to contract
   * POST /auto-symbol/resolve
   */
  resolveAutoSymbol: (p: {
    index_name: string;
    ltp: number;
    option_type: string;
    moneyness: string;
  }) => request('POST', '/auto-symbol/resolve', p),

  /**
   * Verify broker OAuth connection
   * POST /broker/oauth/verify — ONLY for manual "Test Connection" button
   * Response: { liveCheck: { ok: boolean } } - "connected" when liveCheck.ok is true
   */
  verifyBrokerOAuth: () => request('POST', '/broker/oauth/verify'),

  /**
   * Get broker OAuth connection status (passive, safe for profile load)
   * GET /broker/oauth/status
   */
  getBrokerStatusPassive: () => request('GET', '/broker/oauth/status'),
};

