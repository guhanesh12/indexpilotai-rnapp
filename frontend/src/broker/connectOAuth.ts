/**
 * OAuth / direct broker connection.
 *
 * IMPORTANT — verified against the live server:
 *
 *   The server's broker callback HTML page (e.g. /broker/kite/callback)
 *   renders a success card, posts a message to window.opener / window.parent
 *   / window.ReactNativeWebView, then redirects to
 *   https://indexpilotai.com/dashboard?zerodha=connected — NOT to a custom
 *   scheme like indexpilot://broker-callback.
 *
 *   That means:
 *     - `openAuthSessionAsync(url, "indexpilot://broker-callback")` will
 *       NEVER resolve with type: "success" because no redirect to that
 *       scheme ever happens. The sheet just sits there until the user
 *       dismisses it.
 *     - `window.opener.postMessage` doesn't work because the RN auth
 *       session isn't a popup opener.
 *     - `window.ReactNativeWebView.postMessage` doesn't work because the
 *       auth session isn't a WebView — it's SFSafariViewController.
 *
 *   Therefore the RN flow MUST be poll-based:
 *     1. Save keys.
 *     2. GET the login URL — this is the direct broker URL (e.g.
 *        https://kite.zerodha.com/connect/login?api_key=...).
 *     3. Open it with `WebBrowser.openBrowserAsync` (NOT auth session).
 *        The user logs in, the server's callback consumes the token,
 *        redirects to the web dashboard. The browser sheet either
 *        auto-dismisses or the user closes it manually — either way the
 *        app returns to foreground.
 *     4. The BrokerContext's AppState listener fires 10 s of aggressive
 *        /broker/active polling on foreground. The user sees the green
 *        "Connected successfully" popup the moment the session flips.
 */

import * as WebBrowser from "expo-web-browser";
import { request } from "../lib/api";
import {
  brokerBase,
  brokerStatusPath,
  brokerConsumePath,
  brokerExchangePath,
  dhanSaveClientIdPath,
  dhanUpdateTokenPath,
  dhanTestPath,
  dhanCredentialsPath,
  brokerActivePath,
  API_BASE,
} from "./brokerPaths";
import { getBrokerForm, buildAngelOnePayload } from "./brokerForms";

export const BROKER_CALLBACK_SCHEME = "indexpilot://broker-callback";
export const BROKER_CALLBACK_SCHEME_NEW = "indexpilotai://broker-callback";

/**
 * Build the right save-keys payload for each broker — field names differ.
 */
function buildSavePayload(
  id: string,
  payload: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = { ...payload };
  if (id === "angelone") {
    return buildAngelOnePayload(payload);
  }
  // Dhan OAuth mode (apiKey/apiSecret/dhanClientId) vs token mode (dhanAccessToken).
  if (id === "dhan") {
    if (out.apiKey && out.apiSecret && out.dhanClientId) {
      out.redirectUrl = `${API_BASE}/broker/oauth/callback`;
    }
    return out;
  }
  // Upstox needs the redirectUri field matching the registered one.
  if (id === "upstox") {
    if (!out.redirectUri) out.redirectUri = `${API_BASE}/broker/upstox/callback`;
    return out;
  }
  return out;
}

/**
 * Connect to a broker via OAuth / login flow.
 *
 * @returns `{ connected, cancelled }`.
 */
export async function connectOAuth(
  id: string,
  payload: Record<string, string>,
  onBrowserOpened?: () => void
): Promise<{ connected: boolean; cancelled: boolean; loginUrl?: string }> {
  console.log(`[BROKER] connectOAuth START id=${id} keys=${Object.keys(payload).join(",")}`);

  const form = getBrokerForm(id);
  console.log(`[BROKER] form.flow=${form.flow} form.save=${form.save}`);

  if (id === "dhan" && form.flow === "token") {
    console.log("[BROKER] Dhan token-mode — calling connectDhanToken");
    const ok = await connectDhanToken(payload);
    console.log(`[BROKER] connectDhanToken result connected=${ok}`);
    return { connected: ok, cancelled: false };
  }

  // Step 1: Save keys — but the field names and shape differ per broker.
  // Build the right payload for each broker's save endpoint.
  const hasAnyKey = Object.values(payload).some((v) => String(v || "").trim().length > 0);
  if (hasAnyKey) {
    const saveBody = buildSavePayload(id, payload);
    console.log(`[BROKER] step1 POST ${form.save} bodyKeys=${Object.keys(saveBody).join(",")}`);
    try {
      await request("POST", form.save, saveBody);
      console.log(`[BROKER] step1 OK`);
    } catch (e: any) {
      console.error(`[BROKER] step1 FAILED ${form.save}: ${e?.message || e}`);
      throw e;
    }
  } else {
    console.log(`[BROKER] step1 SKIP — no credentials entered, using server-saved keys`);
  }

  if (hasAnyKey) {
    try {
      await waitForKeysSaved(id);
      console.log(`[BROKER] keys verified saved for ${id}`);
    } catch (e: any) {
      console.warn(`[BROKER] keys verification warning: ${e?.message || e}`);
    }
  }

  // Step 2: Get the login URL
  let start: any;
  const step2Path =
    id === "aliceblue"
      ? `POST /broker/${id}/vendor-start`
      : id === "dhan"
      ? `POST /broker/oauth/generate-consent`
      : `GET /broker/${id}/login-url`;
  console.log(`[BROKER] step2 ${step2Path}`);
  try {
    if (id === "aliceblue") {
      start = await request("POST", `${brokerBase(id)}/vendor-start`, payload);
    } else if (id === "dhan") {
      start = await request("POST", `${brokerBase(id)}/generate-consent`, payload);
    } else {
      start = await request("GET", `${brokerBase(id)}/login-url`);
    }
    console.log(`[BROKER] step2 OK keys=${Object.keys(start || {}).join(",")}`);
  } catch (e: any) {
    console.error(`[BROKER] step2 FAILED ${step2Path}: ${e?.message || e}`);
    throw new Error(`Could not get broker login URL: ${e?.message || e}`);
  }

  const url: string = start?.url || start?.loginUrl;
  if (!url) {
    console.error(`[BROKER] step2 EMPTY URL — server returned: ${JSON.stringify(start)}`);
    throw new Error("Login URL unavailable — server returned no URL");
  }
  console.log(`[BROKER] step2 url=${url}`);

  // Step 3: The screen handles WebView navigation itself. We just
  // return the URL and let it open `/broker-webview` with this URL.
  console.log(`[BROKER] step3 returning loginUrl for caller to open WebView`);
  try {
    onBrowserOpened?.();
  } catch {
    /* ignore */
  }
  return { connected: false, cancelled: false, loginUrl: url };
}

async function waitForKeysSaved(id: string, tries = 6): Promise<void> {
  const base = brokerBase(id);
  for (let i = 0; i < tries; i++) {
    try {
      const s: any = await request("GET", `${base}/status`);
      const rawStatus = String(s?.status || s?.connectionStatus || s?.state || "").toLowerCase();
      const hasKeys =
        s?.hasKeys === true ||
        s?.keysSaved === true ||
        s?.hasCredentials === true ||
        (rawStatus.includes("key") && rawStatus.includes("save"));
      if (hasKeys) return;
    } catch {
      /* non-fatal */
    }
    await new Promise((r) => setTimeout(r, 600));
  }
}

/**
 * Poll /broker/active until the requested broker is the active broker
 * AND connected:true. 1 s for first 30 s, then 2 s, hard cap 90 s.
 */
export async function pollUntilActiveConnected(
  id: string,
  opts?: { timeoutMs?: number; intervalMs?: number }
): Promise<boolean> {
  const totalMs = opts?.timeoutMs ?? 90000;
  const start = Date.now();
  let interval = opts?.intervalMs ?? 1000;
  let iter = 0;
  while (Date.now() - start < totalMs) {
    iter += 1;
    try {
      const s: any = await request("GET", brokerActivePath());
      const active = (s?.activeBroker || "").toLowerCase();
      const want = id.toLowerCase();
      const match = active === want && s?.connected === true;
      if (iter <= 3 || iter % 10 === 0 || match) {
        console.log(`[POLL #${iter}] activeBroker=${s?.activeBroker} connected=${s?.connected} match=${match} elapsed=${Date.now() - start}ms`);
      }
      if (match) {
        console.log(`[POLL] connected detected after ${Date.now() - start}ms`);
        return true;
      }
    } catch (e: any) {
      console.warn(`[POLL #${iter}] network error: ${e?.message || e}`);
    }
    const elapsed = Date.now() - start;
    if (elapsed > 30000 && interval < 2000) {
      console.log(`[POLL] slowing cadence at 30s, new interval=2000ms`);
      interval = 2000;
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  console.warn(`[POLL] timed out after ${totalMs}ms id=${id}`);
  return false;
}

/**
 * Dhan token-mode connection: Client ID + Access Token (no OAuth).
 */
export async function connectDhanToken(payload: Record<string, string>): Promise<boolean> {
  const clientId = String(payload.dhanClientId || "").trim();
  const accessToken = String(payload.accessToken || "").trim();

  if (!clientId) {
    throw new Error("Please enter your Dhan Client ID");
  }
  if (!accessToken) {
    throw new Error("Please paste your Dhan Access Token");
  }

  await request("POST", dhanSaveClientIdPath(), { dhanClientId: clientId });
  await request("POST", dhanUpdateTokenPath(), { dhanAccessToken: accessToken });

  try {
    const testRes: any = await request("POST", dhanTestPath(), {});
    if (!testRes?.connected && !testRes?.success) {
      throw new Error(testRes?.error || testRes?.message || "Token rejected by Dhan");
    }
  } catch (e: any) {
    const msg = e?.message || "";
    if (msg.includes("Token rejected") || msg.includes("rejected")) {
      throw new Error("Token rejected — please repaste a fresh token from web.dhan.co");
    }
    throw new Error(e?.message || "Could not reach Dhan test endpoint. Check your internet and try again.");
  }

  try {
    await request("POST", "/broker/active", { broker: "dhan" });
  } catch {
    /* non-fatal */
  }

  return pollDhanTokenStatus();
}

export async function pollDhanTokenStatus(tries = 6): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    try {
      const s: any = await request("GET", dhanCredentialsPath());
      const creds = s?.credentials || s?.data || s;
      if ((creds?.hasAccessToken || s?.hasAccessToken) && (creds?.dhanClientId || s?.dhanClientId)) {
        return true;
      }
    } catch {
      /* non-fatal */
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  return false;
}

function isConnectedFromStatus(id: string, s: any): boolean {
  if (!s) return false;

  if (id === "dhan") {
    const creds = s?.credentials || s?.data || s;
    const status = String(creds?.status || s?.status || "").toLowerCase();
    if (status === "connected" || status === "active") return true;
    if (creds?.hasAccessToken === true || s?.hasAccessToken === true) return true;
    if (s?.liveCheck?.ok !== false && (creds?.hasAccessToken || status)) return true;
    if (status === "token_invalid" || status === "expired") return false;
    return false;
  }

  if (s?.connected === true || s?.connected === "true") return true;
  if (s?.access_token_set === true || s?.tokenValid === true) return true;
  if (s?.hasAccessToken === true) return true;
  const status = String(s?.status || s?.connectionStatus || s?.state || "").toLowerCase();
  if (status === "connected" || status === "active") return true;
  if (status === "token_invalid" || status === "expired") return false;
  return false;
}

export async function pollConnected(id: string, tries = 10): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    try {
      const s: any = await request("GET", brokerStatusPath(id));
      if (isConnectedFromStatus(id, s)) return true;
    } catch {
      /* keep polling */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

export async function verifyConnectionAfterPoll(id: string): Promise<boolean> {
  try {
    const s: any = await request("GET", brokerStatusPath(id));
    if (isConnectedFromStatus(id, s)) return true;
  } catch {
    /* non-fatal */
  }
  return false;
}

export function extractRedirectToken(
  id: string,
  redirectUrl: string
): { tokenId?: string; requestToken?: string; authCode?: string; userId?: string } | null {
  if (!redirectUrl) return null;
  let params: URLSearchParams;
  try {
    params = new URL(redirectUrl).searchParams;
  } catch {
    return null;
  }

  if (id === "dhan") {
    const tokenId = params.get("tokenId");
    return tokenId ? { tokenId } : null;
  }
  if (id === "fyers") {
    const authCode = params.get("auth_code");
    if (authCode) return { requestToken: authCode };
    const code = params.get("code");
    if (code && code !== "200") return { requestToken: code };
    return null;
  }
  if (id === "zerodha" || id === "kite") {
    const requestToken = params.get("request_token");
    return requestToken ? { requestToken } : null;
  }
  if (id === "5paisa" || id === "fivepaisa") {
    const requestToken = params.get("RequestToken");
    return requestToken ? { requestToken } : null;
  }
  if (id === "aliceblue") {
    const authCode = params.get("authCode");
    const userId = params.get("userId");
    return authCode ? { authCode, userId: userId || undefined } : null;
  }
  const token = params.get("code") || params.get("token") || params.get("auth_code");
  return token ? { requestToken: token } : null;
}

export async function consumeRedirectToken(
  id: string,
  token: { tokenId?: string; requestToken?: string; authCode?: string; userId?: string }
): Promise<void> {
  if (id === "dhan" && token.tokenId) {
    await request("POST", brokerConsumePath(id), { tokenId: token.tokenId });
  } else if ((id === "zerodha" || id === "kite") && token.requestToken) {
    await request("POST", brokerConsumePath(id), { requestToken: token.requestToken });
  } else if ((id === "5paisa" || id === "fivepaisa") && token.requestToken) {
    await request("POST", brokerExchangePath(id), { RequestToken: token.requestToken });
  } else if (id === "aliceblue" && token.authCode) {
    await request("POST", brokerExchangePath(id), {
      authCode: token.authCode,
      userId: token.userId,
    });
  } else if (id === "fyers" && token.requestToken) {
    await request("POST", brokerConsumePath(id), { authCode: token.requestToken });
  }
}

