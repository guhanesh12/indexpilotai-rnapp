import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { request } from "../lib/api";
import { showToast } from "../lib/toast";
import {
  brokerActivePath,
  brokerCatalogPath,
  brokerDisconnectPath,
  brokerFundLimitsPath,
  brokerPositionsPath,
  brokerInstrumentsSyncPath,
} from "../broker/brokerPaths";
import { brokerApi, isSyncCapable } from "../api/brokerApi";

export type BrokerDef = {
  id: string;
  name: string;
  short: string;
  status: "live" | "planned";
  color: string;
  website: string;
  features: string[];
  enabled: boolean;
};

export type BrokerActiveResponse = {
  success: boolean;
  activeBroker: string;
  activeBrokerName: string;
  chosen: boolean;
  connected: boolean;
  available: Record<string, boolean>;
  brokers: BrokerDef[];
};

export type BrokerStatus = "unknown" | "loading" | "ready" | "error";

type State = {
  status: BrokerStatus;
  activeBroker: string | null;
  activeBrokerName: string;
  connected: boolean;
  chosen: boolean;
  available: Record<string, boolean>;
  brokers: BrokerDef[];
  funds: any;
  positions: any[];
  instrumentSync: any;
  lastError: string | null;
  refresh: () => Promise<void>;
  switchBroker: (id: string) => Promise<void>;
  disconnect: (id: string) => Promise<void>;
  clearFunds: () => void;
  clearPositions: () => void;
  loadFunds: (id: string) => Promise<void>;
  loadPositions: (id: string) => Promise<void>;
  syncInstruments: (id: string) => Promise<void>;
  pollUntilConnected: (
    brokerId: string,
    opts?: { timeoutMs?: number; intervalMs?: number }
  ) => Promise<boolean>;
};

const Ctx = createContext<State>({} as State);
export const useBroker = () => useContext(Ctx);

const POLL_INTERVAL = 60000;
const POST_FOREGROUND_POLL_MS = 10000;
const POST_FOREGROUND_INTERVAL_MS = 1500;

export function BrokerProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<BrokerStatus>("unknown");
  const [activeBroker, setActiveBroker] = useState<string | null>(null);
  const [activeBrokerName, setActiveBrokerName] = useState<string>("");
  const [connected, setConnected] = useState<boolean>(false);
  const [chosen, setChosen] = useState<boolean>(false);
  const [available, setAvailable] = useState<Record<string, boolean>>({});
  const [brokers, setBrokers] = useState<BrokerDef[]>([]);
  const [funds, setFunds] = useState<any>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [instrumentSync, setInstrumentSync] = useState<any>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const syncedRef = useRef<Set<string>>(new Set());
  const loggedErrorsRef = useRef<Set<string>>(new Set());
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshingRef = useRef(false);
  const lastForegroundPollRef = useRef<number>(0);
  const connectedRef = useRef(false);

  const clearFunds = useCallback(() => setFunds(null), []);
  const clearPositions = useCallback(() => setPositions([]), []);

  const loadFunds = useCallback(async (id: string) => {
    try {
      const res: any = await request("GET", brokerFundLimitsPath());
      const brokerField = String(res?.broker || "").toLowerCase();
      if (brokerField && brokerField !== String(id).toLowerCase()) {
        return;
      }
      const f = res?.funds || res?.data || res;
      if (f?.availableBalance !== undefined || f?.utilizedAmount !== undefined) {
        setFunds(f);
      } else {
        setFunds(null);
      }
    } catch {
      // Keep last known state — never wipe funds on network error
    }
  }, []);

  const loadPositions = useCallback(async (id: string) => {
    try {
      const res: any = await request("GET", brokerPositionsPath());
      const brokerField = String(res?.broker || "").toLowerCase();
      if (brokerField && brokerField !== String(id).toLowerCase()) {
        return;
      }
      const list = res?.positions ?? res?.data ?? [];
      setPositions(Array.isArray(list) ? list : []);
    } catch {
      // Keep last known state
    }
  }, []);

  const syncInstruments = useCallback(async (id: string) => {
    if (!isSyncCapable(id)) {
      return;
    }
    try {
      setInstrumentSync({ syncing: true });
      await brokerApi.syncInstruments(id);
      setInstrumentSync({ syncing: false, success: true });
    } catch (e: any) {
      if (e instanceof Error && e.message.includes("does not support instrument sync")) {
        setInstrumentSync({ syncing: false, skipped: true });
        return;
      }
      console.warn("[BrokerContext] syncInstruments failed:", e?.message || e);
      setInstrumentSync({ syncing: false, error: e?.message || "Sync failed" });
    }
  }, []);

  const runInstrumentSync = useCallback(
    async (brokerId: string) => {
      if (!brokerId || !isSyncCapable(brokerId)) return;
      if (syncedRef.current.has(brokerId)) return;

      try {
        const instStatus: any = await brokerApi.getInstrumentStatus(brokerId);
        const count = instStatus?.count ?? 0;
        const updatedAt = instStatus?.updatedAt ? new Date(instStatus.updatedAt).getTime() : 0;
        const stale = updatedAt === 0 || Date.now() - updatedAt > 24 * 60 * 60 * 1000;

        if (count === 0 || stale) {
          syncedRef.current.add(brokerId);
          await syncInstruments(brokerId);
        }
      } catch (e: any) {
        if (e instanceof Error && e.message.includes("does not support instrument sync")) {
          syncedRef.current.add(brokerId);
          return;
        }
        console.warn("[BrokerContext] instrument status check failed:", e?.message || e);
      }
    },
    [syncInstruments]
  );

  /**
   * Single source of truth for broker state. Never sets `connected=false`
   * from a network failure — only from a 200 response with explicit value.
   */
  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;

    try {
      const [catalogRes, activeRes] = await Promise.all([
        brokerApi.getBrokerCatalog().catch((e) => {
          return { success: false, brokers: [] };
        }),
        brokerApi.getBrokerActive().catch((e) => {
          throw e;
        }),
      ]);

      const brokerList: BrokerDef[] = catalogRes?.brokers || [];
      const activeBrokerId = activeRes?.activeBroker || null;
      const activeBrokerNameVal = activeRes?.activeBrokerName || "";
      const chosenVal = !!activeRes?.chosen;
      const connectedVal = !!activeRes?.connected;

      console.log(`[BROKER_CTX] refresh activeBroker=${activeBrokerId} chosen=${chosenVal} connected=${connectedVal}`);

      setBrokers(brokerList);
      setActiveBroker(activeBrokerId);
      setActiveBrokerName(activeBrokerNameVal);
      setChosen(chosenVal);
      setConnected((prev) => {
        const next = connectedVal ? true : prev;
        connectedRef.current = next;
        return next;
      });
      setAvailable(activeRes?.available || {});
      setStatus("ready");
      setLastError(null);
      loggedErrorsRef.current.clear();

      if (activeBrokerId && chosenVal && (connectedVal || connectedRef.current)) {
        await loadFunds(activeBrokerId);
        await loadPositions(activeBrokerId);
        await runInstrumentSync(activeBrokerId);
      }
    } catch (e: any) {
      const msg = String(e?.message || e || "Unknown error");
      const isAuth = msg.includes("401") || msg.includes("Unauthorized") || msg.includes("Session expired");

      if (isAuth) {
        try {
          const { supabase } = await import("../lib/supabase");
          await supabase.auth.refreshSession();
          await refresh();
          return;
        } catch {
          setLastError("Session expired. Please sign in again.");
        }
      } else {
        if (!loggedErrorsRef.current.has(msg)) {
          loggedErrorsRef.current.add(msg);
          console.warn(`[BROKER_CTX] refresh failed: ${msg}`);
        }
        setLastError(msg);
      }

      // Network failure: keep last known broker state. Mark status as error only if
      // we never had any state — otherwise stay ready to avoid false "not connected" UI.
      setStatus((prev) => (prev === "ready" ? "ready" : "error"));
    } finally {
      refreshingRef.current = false;
    }
  }, [loadFunds, loadPositions, runInstrumentSync]);

  /**
   * Poll /broker/active until connected for the given broker.
   * Never marks the UI as disconnected on network failure — only on explicit 200 false.
   * Uses an aggressive cadence: 1s for the first 30s, then 2s, capped at 90s total.
   * Every individual poll request has its own short timeout (handled by api.ts).
   */
  const pollUntilConnected = useCallback(
    async (brokerId: string, opts?: { timeoutMs?: number; intervalMs?: number }) => {
      const totalMs = opts?.timeoutMs ?? 90000;
      const start = Date.now();
      let interval = opts?.intervalMs ?? 1000;
      while (Date.now() - start < totalMs) {
        try {
          const s: any = await brokerApi.getBrokerActive();
          if (
            s?.success &&
            (s?.activeBroker || "").toLowerCase() === brokerId.toLowerCase() &&
            s.connected === true
          ) {
            return true;
          }
        } catch {
          /* network error → keep polling, do NOT mark disconnected */
        }
        const elapsed = Date.now() - start;
        if (elapsed > 30000 && interval < 2000) interval = 2000;
        await new Promise((r) => setTimeout(r, interval));
      }
      return false;
    },
    []
  );

  const switchBroker = useCallback(
    async (id: string) => {
      setStatus("loading");
      try {
        if (activeBroker && activeBroker !== id && connected) {
          try {
            await request("POST", brokerDisconnectPath(activeBroker), {});
          } catch (e: any) {
            console.warn("[BrokerContext] pre-switch disconnect failed:", e?.message || e);
          }
        }

        await brokerApi.setBrokerActive(id);
        setFunds(null);
        setPositions([]);
        setInstrumentSync(null);
        syncedRef.current.clear();
        // Optimistic UI: new broker is active but not yet connected.
        // Render name immediately so the screen never shows the old name.
        const newName =
          (brokers.find((b) => b.id === id)?.name as string) || id.toUpperCase();
        setActiveBroker(id);
        setActiveBrokerName(newName);
        connectedRef.current = false;
        setConnected(false);
        setStatus("ready");
        await refresh();
      } catch (e: any) {
        const msg = e?.message || "Failed to switch broker";
        setLastError(msg);
        setStatus("ready");
        showToast(msg);
      }
    },
    [activeBroker, connected, refresh, brokers]
  );

  const disconnect = useCallback(
    async (id: string) => {
      try {
        await request("POST", brokerDisconnectPath(id), {});
      } catch (e: any) {
        console.warn("[BrokerContext] disconnect failed:", e?.message || e);
      }
      connectedRef.current = false;
      setConnected(false);
      setFunds(null);
      setPositions([]);
      setInstrumentSync(null);
      syncedRef.current.delete(id);
      await refresh();
    },
    [refresh]
  );

  // Initial load + 60s polling while Broker screen is mounted.
  useEffect(() => {
    refresh();

    const startPolling = () => {
      if (pollTimerRef.current) return;
      pollTimerRef.current = setInterval(() => {
        refresh();
      }, POLL_INTERVAL);
    };

    const stopPolling = () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    startPolling();

    let postFgTimer: ReturnType<typeof setTimeout> | null = null;
    let postFgInterval: ReturnType<typeof setInterval> | null = null;
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        // Throttle: avoid double-refresh when this is called multiple times within 1s.
        const now = Date.now();
        if (now - lastForegroundPollRef.current > 500) {
          lastForegroundPollRef.current = now;
          refresh();
          startPolling();
          // Extra aggressive polling for 10s after foreground — catches the case
          // where the user manually switches back to the app instead of the
          // OAuth sheet auto-closing. 1s cadence to detect new sessions fast.
          if (postFgTimer) clearTimeout(postFgTimer);
          if (postFgInterval) clearInterval(postFgInterval);
          postFgInterval = setInterval(() => {
            refresh();
          }, 1000);
          postFgTimer = setTimeout(() => {
            if (postFgInterval) {
              clearInterval(postFgInterval);
              postFgInterval = null;
            }
          }, POST_FOREGROUND_POLL_MS);
        }
      } else {
        stopPolling();
        if (postFgTimer) {
          clearTimeout(postFgTimer);
          postFgTimer = null;
        }
        if (postFgInterval) {
          clearInterval(postFgInterval);
          postFgInterval = null;
        }
      }
    });

    return () => {
      stopPolling();
      subscription.remove();
      if (postFgTimer) clearTimeout(postFgTimer);
      if (postFgInterval) clearInterval(postFgInterval);
    };
  }, [refresh]);

  return (
    <Ctx.Provider
      value={{
        status,
        activeBroker,
        activeBrokerName,
        connected,
        chosen,
        available,
        brokers,
        funds,
        positions,
        instrumentSync,
        lastError,
        refresh,
        switchBroker,
        disconnect,
        clearFunds,
        clearPositions,
        loadFunds,
        loadPositions,
        syncInstruments,
        pollUntilConnected,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export async function loadPendingDeepLink(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem("pending_deep_link");
  } catch {
    return null;
  }
}

export async function savePendingDeepLink(url: string): Promise<void> {
  try {
    await AsyncStorage.setItem("pending_deep_link", url);
  } catch {
    /* ignore */
  }
}

export async function clearPendingDeepLink(): Promise<void> {
  try {
    await AsyncStorage.removeItem("pending_deep_link");
  } catch {
    /* ignore */
  }
}

export async function loadPendingReferralCode(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem("pending_referral_code");
  } catch {
    return null;
  }
}

export async function savePendingReferralCode(code: string): Promise<void> {
  try {
    await AsyncStorage.setItem("pending_referral_code", code.toUpperCase());
  } catch {
    /* ignore */
  }
}

export async function clearPendingReferralCode(): Promise<void> {
  try {
    await AsyncStorage.removeItem("pending_referral_code");
  } catch {
    /* ignore */
  }
}
