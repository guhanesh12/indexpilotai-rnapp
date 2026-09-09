// src/lib/pinApi.ts
import { supabase } from "./supabase";
import { Storage } from "./storage";

// Direct Supabase Edge Function URL for PIN management
const BASE = "https://oklgqelcaujxntgjyuis.supabase.co/functions/v1/user-pin";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbGdxZWxjYXVqeG50Z2p5dWlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MTA0NjUsImV4cCI6MjA3NTA4NjQ2NX0.FnFcNQXGXGpsQXvR4TW1LDc23FlIBBglLhZsRdn9VV0";

async function call(path: string, method: "GET" | "POST", body?: any) {
  let session: any = null;
  try {
    const result = await supabase.auth.getSession();
    session = result?.data?.session;
  } catch (e) {
    console.log('[PinApi] Invalid session, skipping call:', e);
    throw new Error("Not authenticated");
  }
  if (!session?.access_token) throw new Error("Not authenticated");

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: ANON,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));
  return { status: res.status, ...json };
}

// ─── Local PIN Storage Functions ─────────────────────────────
// NOTE: Per specification, we do NOT store raw PIN in AsyncStorage
// All PIN operations go through the server API

/**
 * Check if a local PIN exists in storage.
 */
async function hasLocalPin(): Promise<boolean> {
  try {
    const pin = await Storage.getPin();
    return !!pin;
  } catch (e) {
    console.warn('[LocalPin] Failed to check local PIN:', e);
    return false;
  }
}

/**
 * Remove local PIN from storage on sign out.
 */
async function removeLocalPin(): Promise<void> {
  try {
    await Storage.clearPin();
    console.log('[LocalPin] Local PIN cleared');
  } catch (e) {
    console.warn('[LocalPin] Failed to clear local PIN:', e);
  }
}

export const PinApi = {
  status: async () => {
    return call("/status", "GET");
  },
  set: async (pin: string, confirmPin: string) => {
    return call("/set", "POST", { pin, confirmPin });
  },
  verify: async (pin: string) => {
    return call("/verify", "POST", { pin });
  },
  forgot: () => call("/forgot", "POST"),
  reset: (otp: string, pin: string, confirmPin: string) =>
    call("/reset", "POST", { otp, pin, confirmPin }),
  // Local storage helpers
  hasLocalPin,
  removeLocalPin,
};
