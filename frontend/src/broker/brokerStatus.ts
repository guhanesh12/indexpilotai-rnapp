/**
 * Normalize broker status responses across all 8 brokers.
 */

import { redirectUrlFor } from "./brokerPaths";

export type NormalizedStatus = {
  connected: boolean;
  status: "connected" | "keys_saved" | "token_invalid" | "expired" | "not_connected" | "disconnected" | "unknown";
  label: string;
  color: string;
  balance?: string;
  lastError?: string;
  redirectUrl?: string;
};

const STATUS_MAP: Record<string, NormalizedStatus> = {
  connected: { connected: true, status: "connected", label: "Connected", color: "#34D399" },
  keys_saved: { connected: false, status: "keys_saved", label: "Keys saved — login pending", color: "#FFB800" },
  token_invalid: { connected: false, status: "token_invalid", label: "Token rejected / expired", color: "#FF3344" },
  expired: { connected: false, status: "expired", label: "Token rejected / expired", color: "#FF3344" },
  not_connected: { connected: false, status: "not_connected", label: "Not connected", color: "#64748b" },
  disconnected: { connected: false, status: "disconnected", label: "Not connected", color: "#64748b" },
};

export function mapBrokerStatus(raw: any, brokerId?: string): NormalizedStatus {
  if (!raw) {
    return STATUS_MAP.not_connected;
  }

  const rawStatus = String(raw.status || raw.connectionStatus || raw.state || "").toLowerCase();

  if (raw.connected === true || rawStatus === "connected" || rawStatus === "active") {
    return {
      ...STATUS_MAP.connected,
      balance: raw.availableBalance ?? raw.balance ?? raw.funds?.availableBalance,
      redirectUrl: raw.redirect_uri ?? raw.redirect_url ?? raw.redirectUri,
    };
  }

  if (raw.hasAccessToken === true) {
    return {
      ...STATUS_MAP.connected,
      balance: raw.availableBalance ?? raw.balance ?? raw.funds?.availableBalance,
      redirectUrl: raw.redirect_uri ?? raw.redirect_url ?? raw.redirectUri,
    };
  }

  if (
    rawStatus.includes("key") && rawStatus.includes("save") ||
    raw.hasKeys === true ||
    raw.keysSaved === true ||
    raw.hasCredentials === true
  ) {
    return STATUS_MAP.keys_saved;
  }

  if (rawStatus.includes("invalid") || rawStatus.includes("reject")) {
    return STATUS_MAP.token_invalid;
  }

  if (rawStatus.includes("expir")) {
    return STATUS_MAP.expired;
  }

  if (rawStatus.includes("disconnect")) {
    return STATUS_MAP.disconnected;
  }

  if (raw.connected === false || rawStatus === "not_connected") {
    return STATUS_MAP.not_connected;
  }

  return {
    connected: false,
    status: "unknown",
    label: rawStatus || "Unknown",
    color: "#64748b",
    lastError: raw.lastError || raw.error || raw.message,
    redirectUrl: raw.redirect_uri ?? raw.redirect_url ?? raw.redirectUri,
  };
}

/**
 * Get the redirect URL for a broker from status response or fallback.
 */
export function getRedirectUrl(brokerId: string, status: any): string | undefined {
  if (!status) return undefined;
  const url = status.redirect_uri ?? status.redirect_url ?? status.redirectUri;
  if (url) return url;
  return redirectUrlFor(brokerId);
}
