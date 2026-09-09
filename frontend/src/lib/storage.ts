import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// SecureStore is native-only. On web we fall back to AsyncStorage (which uses
// localStorage under the hood). Tokens are less sensitive in the web preview.
const isWeb = Platform.OS === 'web';

// Wrap SecureStore calls with error handling to prevent crashes
// CRITICAL: All storage operations must NEVER throw - they can block app initialization
const safeSecureGet = async (k: string): Promise<string | null> => {
  if (isWeb) {
    try {
      return await AsyncStorage.getItem(k);
    } catch {
      return null;
    }
  }
  try {
    return await SecureStore.getItemAsync(k);
  } catch (e) {
    console.warn('[Storage] SecureStore get failed, falling back:', k);
    try {
      return await AsyncStorage.getItem(k);
    } catch {
      return null;
    }
  }
};

const safeSecureSet = async (k: string, v: string): Promise<void> => {
  if (isWeb) {
    try {
      await AsyncStorage.setItem(k, v);
    } catch {}
    return;
  }
  try {
    await SecureStore.setItemAsync(k, v);
  } catch (e) {
    console.warn('[Storage] SecureStore set failed, falling back:', k);
    try {
      await AsyncStorage.setItem(k, v);
    } catch {}
  }
};

const safeSecureDel = async (k: string): Promise<void> => {
  if (isWeb) {
    try {
      await AsyncStorage.removeItem(k);
    } catch {}
    return;
  }
  try {
    await SecureStore.deleteItemAsync(k);
  } catch (e) {
    console.warn('[Storage] SecureStore delete failed, falling back:', k);
    try {
      await AsyncStorage.removeItem(k);
    } catch {}
  }
};

const secureGet = (k: string) => safeSecureGet(k);
const secureSet = (k: string, v: string) => safeSecureSet(k, v);
const secureDel = (k: string) => safeSecureDel(k);

const KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER: 'user',
  PIN: 'user_pin',
  INSTRUMENTS_PREFIX: 'instruments:',
  FCM_TOKEN: 'fcm_token',
};

export const Storage = {
  async saveTokens(access: string, refresh: string) {
    await secureSet(KEYS.ACCESS_TOKEN, access);
    await secureSet(KEYS.REFRESH_TOKEN, refresh);
  },
  async getAccessToken() {
    return secureGet(KEYS.ACCESS_TOKEN);
  },
  async getRefreshToken() {
    return secureGet(KEYS.REFRESH_TOKEN);
  },
  async clearTokens() {
    await secureDel(KEYS.ACCESS_TOKEN);
    await secureDel(KEYS.REFRESH_TOKEN);
    await secureDel(KEYS.USER);
  },
  async saveUser(u: any) {
    await secureSet(KEYS.USER, JSON.stringify(u));
  },
  async getUser() {
    const raw = await secureGet(KEYS.USER);
    return raw ? JSON.parse(raw) : null;
  },
  async savePin(pin: string) {
    await secureSet(KEYS.PIN, pin);
  },
  async getPin() {
    return secureGet(KEYS.PIN);
  },
  async clearPin() {
    await secureDel(KEYS.PIN);
  },

  // ─── CHUNKED INSTRUMENTS (NEW: Fixes CursorWindow row size limit) ───────
  async saveInstrumentsChunked(bundle: { NIFTY: any[]; BANKNIFTY: any[]; SENSEX: any[] }) {
    const ts = Date.now();
    const chunks = [
      { key: 'inst_NIFTY', data: bundle.NIFTY },
      { key: 'inst_BANKNIFTY', data: bundle.BANKNIFTY },
      { key: 'inst_SENSEX', data: bundle.SENSEX },
    ];
    // Parallel save
    await Promise.all(chunks.map(({ key, data }) =>
      AsyncStorage.setItem(key, JSON.stringify({ ts, data }))
    ));
    console.log('[Storage] Saved 3 instrument chunks');
  },

async getInstrumentsChunked(): Promise<{ data: { NIFTY: any[]; BANKNIFTY: any[]; SENSEX: any[] }; total: number; counts: { NIFTY: number; BANKNIFTY: number; SENSEX: number }; isFresh: boolean }> {
    // Single gets (bypass multi* row scan during startup)
    const [niftyRaw, bankRaw, sensexRaw] = await Promise.all([
      AsyncStorage.getItem('inst_NIFTY'),
      AsyncStorage.getItem('inst_BANKNIFTY'),
      AsyncStorage.getItem('inst_SENSEX')
    ]);
    
    const bundle: { NIFTY: any[]; BANKNIFTY: any[]; SENSEX: any[] } = {
      NIFTY: [], BANKNIFTY: [], SENSEX: []
    };
    let isFresh = true;
    const now = Date.now();
    const ttl = 7 * 24 * 60 * 60 * 1000; // 7 days

    const chunks = [
      { key: 'inst_NIFTY', raw: niftyRaw, index: 'NIFTY' as const },
      { key: 'inst_BANKNIFTY', raw: bankRaw, index: 'BANKNIFTY' as const },
      { key: 'inst_SENSEX', raw: sensexRaw, index: 'SENSEX' as const }
    ];

    for (const { key, raw, index } of chunks) {
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        (bundle[index] as any[]).push(...parsed.data);
        if (now - parsed.ts > ttl) isFresh = false;
      } catch (e) {
        console.warn('[Storage] Invalid chunk', key);
      }
    }

    // Skip migration if old key too big (causes crash) - clearInstruments() handles
    const oldKey = KEYS.INSTRUMENTS_PREFIX + 'dhan_csv_bundle';
    try {
      const oldRaw = await AsyncStorage.getItem(oldKey);
      if (oldRaw && bundle.NIFTY.length === 0 && oldRaw.length < 5_000_000) { // <5MB safe
        const old = JSON.parse(oldRaw);
        if (old.data) {
          await Storage.saveInstrumentsChunked(old.data.instruments);
          await AsyncStorage.removeItem(oldKey);
          console.log('[Storage] Migrated old cache');
          return Storage.getInstrumentsChunked();
        }
      }
    } catch (e) {
      console.warn('[Storage] Skipping migration (likely oversized key)');
    }

    console.log('[Storage] Loaded bundle:', Object.values(bundle).reduce((sum, arr) => sum + arr.length, 0), 'options');
    return { data: bundle, total: Object.values(bundle).reduce((sum: number, arr: any[]) => sum + arr.length, 0), counts: {
      NIFTY: bundle.NIFTY.length,
      BANKNIFTY: bundle.BANKNIFTY.length,
      SENSEX: bundle.SENSEX.length
    }, isFresh };
  },

  async clearInstruments() {
    try {
      // Clear old monolithic FIRST (single remove avoids multiRemove row scan crash)
      const oldKey = KEYS.INSTRUMENTS_PREFIX + 'dhan_csv_bundle';
      await AsyncStorage.removeItem(oldKey);
    } catch {}
    const chunkKeys = ['inst_NIFTY', 'inst_BANKNIFTY', 'inst_SENSEX'];
    await AsyncStorage.multiRemove(chunkKeys);
    console.log('[Storage] Cleared instruments');
  },

  // ─── DEPRECATED: Old monolithic (log + redirect) ────────────────────────
  async saveInstruments(key: string, data: any) {
    console.warn('[Storage] saveInstruments() DEPRECATED - use saveInstrumentsChunked({NIFTY:[],...})');
    if (key === 'dhan_csv_bundle') {
      await Storage.saveInstrumentsChunked(data);
      return;
    }
    await AsyncStorage.setItem(KEYS.INSTRUMENTS_PREFIX + key, JSON.stringify({ ts: Date.now(), data }));
  },
  async getInstruments(key: string) {
    console.warn('[Storage] getInstruments() DEPRECATED - use getInstrumentsChunked()');
    if (key === 'dhan_csv_bundle') return Storage.getInstrumentsChunked();
    const raw = await AsyncStorage.getItem(KEYS.INSTRUMENTS_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  },

  // Engine local intent flag (set by user actions). Helps UI show RUNNING
  // between cron candle ticks where /engine/status returns isRunning:false.
  async setEngineIntent(running: boolean, interval?: string) {
    const v = JSON.stringify({ running, interval: interval || '15', ts: Date.now() });
    await AsyncStorage.setItem('engine_intent', v);
  },
  async getEngineIntent(): Promise<{ running: boolean; interval: string; ts: number } | null> {
    const raw = await AsyncStorage.getItem('engine_intent');
    return raw ? JSON.parse(raw) : null;
  },
// Save Dhan creds locally (token never leaves device beyond Supabase save)
  async setBrokerCreds(clientId: string, accessToken: string) {
    await AsyncStorage.setItem('broker_creds', JSON.stringify({ clientId, accessToken, ts: Date.now() }));
  },
  async getBrokerCreds(): Promise<{ clientId: string; accessToken: string; ts: number } | null> {
    const raw = await AsyncStorage.getItem('broker_creds');
    return raw ? JSON.parse(raw) : null;
  },
  async clearBrokerCreds() {
    await AsyncStorage.removeItem('broker_creds');
  },

  // Dhan OAuth credentials (API Key & API Secret - saved locally for OAuth flow)
  async setDhanOAuthCreds(clientId: string, apiKey: string, apiSecret: string) {
    await AsyncStorage.setItem('dhan_oauth_creds', JSON.stringify({ clientId, apiKey, apiSecret, ts: Date.now() }));
  },
  async getDhanOAuthCreds(): Promise<{ clientId: string; apiKey: string; apiSecret: string; ts: number } | null> {
    const raw = await AsyncStorage.getItem('dhan_oauth_creds');
    return raw ? JSON.parse(raw) : null;
  },
  async clearDhanOAuthCreds() {
    await AsyncStorage.removeItem('dhan_oauth_creds');
  },

  // ─── FCM PUSH TOKEN ───────────────────────────
  async setFcmToken(token: string) {
    await AsyncStorage.setItem(KEYS.FCM_TOKEN, token);
  },
  async getFcmToken(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.FCM_TOKEN);
  },
  async clearFcmToken() {
    await AsyncStorage.removeItem(KEYS.FCM_TOKEN);
  },

  // ─── FINGERPRINT AUTH ───────────────────────────
  async setFingerprintEnabled(enabled: boolean) {
    await AsyncStorage.setItem('fingerprint_enabled', String(enabled));
  },
  async getFingerprintEnabled(): Promise<boolean> {
    const raw = await AsyncStorage.getItem('fingerprint_enabled');
    return raw === 'true';
  },
  async clearFingerprintEnabled() {
    await AsyncStorage.removeItem('fingerprint_enabled');
  },
};

