import { supabase } from './supabase';
import { Storage } from './storage';
import { getCachedAccessToken } from '../contexts/AuthContext';

export async function getAccessToken(): Promise<string | null> {
  // 1) Immediately cached token from AuthContext.signIn (in-memory)
  try {
    const cached = getCachedAccessToken();
    if (cached) return cached;
  } catch {
    // ignore
  }

  // 2) Supabase session (in-memory / managed by supabase-js)
  try {
    const s = await supabase.auth.getSession();
    const t = s?.data?.session?.access_token ?? null;
    if (t) return t;
  } catch {
    // ignore
  }

  // 3) Attempt refresh (may repopulate session)
  try {
    const r = await supabase.auth.refreshSession();
    const t = r?.data?.session?.access_token ?? null;
    if (t) return t;
  } catch {
    // ignore
  }

  // 4) Last resort: Storage token (may fail in Expo Go depending on hydration timing)
  try {
    const t = await Storage.getAccessToken();
    if (t) return t;
  } catch {
    // ignore
  }

  return null;
}
