/**
 * Single source of truth for broker API path resolution.
 *
 * Every new broker follows the generic pattern:
 *   connect flow → /broker/<id>/save-keys, /broker/<id>/login-url,
 *                  /broker/<id>/status, /broker/<id>/verify, /broker/<id>/disconnect
 *
 * Only the two legacy aliases (zerodha → kite, dhan → oauth) stay hardcoded here.
 * Adding a NEW broker requires ZERO changes to this file — the id path is the default.
 */

export const API_BASE = "https://api.indexpilotai.com/functions/v1/make-server-c4d79cb7";

export function brokerBase(brokerId: string): string {
  if (brokerId === 'zerodha') return '/broker/kite';
  if (brokerId === 'dhan') return '/broker/oauth';
  return `/broker/${brokerId}`;
}

export function brokerSaveKeysPath(brokerId: string): string {
  return `${brokerBase(brokerId)}/save-keys`;
}

export function brokerLoginUrlPath(brokerId: string): string {
  return `${brokerBase(brokerId)}/login-url`;
}

export function brokerStatusPath(brokerId: string): string {
  return `${brokerBase(brokerId)}/status`;
}

export function brokerVerifyPath(brokerId: string): string {
  return `${brokerBase(brokerId)}/verify`;
}

export function brokerDisconnectPath(brokerId: string): string {
  return `${brokerBase(brokerId)}/disconnect`;
}

export function brokerCallbackPath(brokerId: string): string {
  return `${brokerBase(brokerId)}/callback`;
}

export function brokerInstrumentsStatusPath(brokerId: string): string {
  return `${brokerBase(brokerId)}/instruments/status`;
}

export function brokerInstrumentsSyncPath(brokerId: string): string {
  return `${brokerBase(brokerId)}/instruments/sync`;
}

export function brokerActivePath(): string {
  return '/broker/active';
}

export function brokerCatalogPath(): string {
  return '/brokers';
}

export function brokerFundLimitsPath(): string {
  return '/fund-limits';
}

export function brokerPositionsPath(): string {
  return '/positions';
}

export function brokerConsumePath(brokerId: string): string {
  return `${brokerBase(brokerId)}/consume`;
}

export function brokerExchangePath(brokerId: string): string {
  return `${brokerBase(brokerId)}/exchange`;
}

export function brokerReconnectPath(brokerId: string): string {
  return `${brokerBase(brokerId)}/reconnect`;
}

export function redirectUrlFor(brokerId: string): string {
  return `${API_BASE}/broker/${brokerId}/callback`;
}

// Dhan token-mode endpoints (no OAuth)
export function dhanSaveClientIdPath(): string {
  return '/api-credentials';
}

export function dhanUpdateTokenPath(): string {
  return '/update-access-token';
}

export function dhanTestPath(): string {
  return '/test-dhan';
}

export function dhanCredentialsPath(): string {
  return '/api-credentials';
}

/**
 * OAuth access-token finalize endpoint — POST {authCode} to it after the
 * in-app WebView intercepts the callback URL. The Supabase function
 * exchanges the authCode with the broker's API and saves the access_token
 * + sets broker_connected=true.
 *
 * Returns: 200 { success: true, connected: true, ... } on success.
 */
export function brokerAccessTokenPath(brokerId: string): string {
  return `${brokerBase(brokerId)}/access-token`;
}

/** Legacy broker IDs map to their configured path alias. */
export function canonicalBrokerId(brokerId: string): string {
  if (brokerId === 'kite') return 'zerodha';
  return brokerId;
}

/**
 * The connect flow type for a broker.
 * - "keys"  → manual credential entry (POST save-keys → poll status)
 * - "oauth" → browser-based OAuth (openAuthSession → poll status)
 * - "login" → direct login form (POST login → poll status)
 */
export type Flow = "keys" | "oauth" | "login";

export const brokerFlow = (id: string): Flow =>
  ({
    dhan: "oauth",
    zerodha: "oauth",
    upstox: "oauth",
    fyers: "oauth",
    "5paisa": "oauth",
    aliceblue: "oauth",
    groww: "keys",
    angelone: "login",
  } as Record<string, Flow>)[id] ?? "keys";
