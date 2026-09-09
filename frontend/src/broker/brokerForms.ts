/**
 * Declarative form schema — the ONLY per-broker RN constant for form fields.
 *
 * Each entry maps a broker id to:
 *  - `save`: the API path to POST credentials to
 *  - `fields`: the input fields to render (key, label, secret, optional, keyboard, hint)
 *  - `cta`: button label
 *  - `flow`: "oauth" | "keys" | "login" | "token" (Dhan token mode)
 *  - `needsRedirect`: whether to show redirect URL card
 *  - `redirectDefault`: default redirect URL for OAuth brokers (optional)
 *
 * Unknown broker id → generic `{ apiKey, apiSecret }` form posting to
 * `${brokerBase(id)}/save-keys`.
 */

import { brokerBase, redirectUrlFor } from "./brokerPaths";

export type Field = {
  key: string;
  label: string;
  secret?: boolean;
  optional?: boolean;
  keyboard?: "default" | "number-pad";
  hint?: string;
  copyable?: boolean;
  multiline?: boolean;
};

export type BrokerForm = {
  save: string;
  fields: Field[];
  cta: string;
  flow: "oauth" | "keys" | "login" | "token";
  needsRedirect: boolean;
  redirectDefault?: string;
};

export const BROKER_FORMS: Record<string, BrokerForm> = {
  dhan: {
    save: "/api-credentials",
    cta: "Connect Dhan",
    flow: "token",
    needsRedirect: false,
    fields: [
      { key: "dhanClientId", label: "Dhan Client ID (UCC)", keyboard: "number-pad", hint: "Numeric UCC from web.dhan.co → My Profile → Access DhanHQ APIs" },
      { key: "accessToken", label: "Access Token", multiline: true, hint: "Paste the access token from web.dhan.co (valid ~24h)" },
    ],
  },
  zerodha: {
    save: "/broker/kite/save-keys",
    cta: "Login with Zerodha",
    flow: "oauth",
    needsRedirect: true,
    redirectDefault: redirectUrlFor("zerodha"),
    fields: [
      { key: "apiKey", label: "API Key" },
      { key: "apiSecret", label: "API Secret", secret: true },
    ],
  },
  kite: {
    save: "/broker/kite/save-keys",
    cta: "Login with Zerodha",
    flow: "oauth",
    needsRedirect: true,
    redirectDefault: redirectUrlFor("zerodha"),
    fields: [
      { key: "apiKey", label: "API Key" },
      { key: "apiSecret", label: "API Secret", secret: true },
    ],
  },
  groww: {
    save: "/broker/groww/save-keys",
    cta: "Connect Groww",
    flow: "keys",
    needsRedirect: false,
    fields: [
      { key: "accessToken", label: "Access Token", hint: "Trade API access token (min 20 chars)" },
      { key: "growwUserId", label: "Groww User ID", optional: true },
    ],
  },
  upstox: {
    save: "/broker/upstox/save-keys",
    cta: "Login with Upstox",
    flow: "oauth",
    needsRedirect: true,
    redirectDefault: redirectUrlFor("upstox"),
    fields: [
      { key: "apiKey", label: "API Key" },
      { key: "apiSecret", label: "API Secret", secret: true },
    ],
  },
  fyers: {
    save: "/broker/fyers/save-keys",
    cta: "Login with Fyers",
    flow: "oauth",
    needsRedirect: true,
    redirectDefault: redirectUrlFor("fyers"),
    fields: [
      { key: "appId", label: "App ID" },
      { key: "appSecret", label: "App Secret", secret: true },
    ],
  },
  angelone: {
    save: "/broker/angelone/login",
    cta: "Login to Angel One",
    flow: "login",
    needsRedirect: true,
    redirectDefault: redirectUrlFor("angelone"),
    fields: [
      { key: "apiKey", label: "SmartAPI Trading API Key" },
      { key: "clientCode", label: "Client Code" },
      { key: "password", label: "MPIN / Password", secret: true },
      { key: "totp", label: "6-digit TOTP or Base32 secret", hint: "Enter 6-digit TOTP code, or the Base32 secret for auto-reconnect" },
    ],
  },
  aliceblue: {
    save: "/broker/aliceblue/vendor-start",
    cta: "Login with Aliceblue",
    flow: "oauth",
    needsRedirect: true,
    redirectDefault: redirectUrlFor("aliceblue"),
    fields: [
      { key: "appCode", label: "App Code" },
      { key: "apiSecret", label: "API Secret", secret: true },
      { key: "userId", label: "User ID", optional: true, hint: "Optional — Aliceblue returns it on redirect" },
    ],
  },
  "5paisa": {
    save: "/broker/5paisa/save-keys",
    cta: "Login with 5paisa",
    flow: "oauth",
    needsRedirect: true,
    redirectDefault: redirectUrlFor("5paisa"),
    fields: [
      { key: "appKey", label: "App Key (Vendor Key)" },
      { key: "encryptionKey", label: "Encryption Key", secret: true },
      { key: "userKey", label: "User Key" },
    ],
  },
  fivepaisa: {
    save: "/broker/5paisa/save-keys",
    cta: "Login with 5paisa",
    flow: "oauth",
    needsRedirect: true,
    redirectDefault: redirectUrlFor("5paisa"),
    fields: [
      { key: "appKey", label: "App Key (Vendor Key)" },
      { key: "encryptionKey", label: "Encryption Key", secret: true },
      { key: "userKey", label: "User Key" },
    ],
  },
};

/**
 * Returns the form definition for a broker id.
 * Falls back to a generic apiKey/apiSecret form for unknown brokers.
 */
export function getBrokerForm(brokerId: string): BrokerForm {
  const form = BROKER_FORMS[brokerId];
  if (form) return form;

  return {
    save: `${brokerBase(brokerId)}/save-keys`,
    cta: `Connect ${brokerId}`,
    flow: "keys",
    needsRedirect: true,
    redirectDefault: redirectUrlFor(brokerId),
    fields: [
      { key: "apiKey", label: "API Key" },
      { key: "apiSecret", label: "API Secret", secret: true },
    ],
  };
}

/**
 * Check if a totp field value is a 6-digit code or a Base32 secret.
 */
export function isTotpCode(value: string): boolean {
  return /^\d{6}$/.test(value);
}

/**
 * Build the payload for Angel One login, routing totp correctly.
 */
export function buildAngelOnePayload(keys: Record<string, string>): Record<string, string> {
  const payload: Record<string, string> = { ...keys };
  const totpValue = keys.totp || '';
  if (totpValue) {
    if (isTotpCode(totpValue)) {
      payload.totp = totpValue;
    } else {
      payload.totpSecret = totpValue;
    }
    delete payload.totp;
  }
  return payload;
}
