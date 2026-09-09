import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { PinApi } from '../lib/pinApi';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Storage } from '../lib/storage';
import { tryFingerprintWithRetries, isFingerprintAvailable } from '../lib/fingerprint';
import type { FingerprintResult } from '../lib/fingerprint';

// Time in ms to re-lock the app when backgrounded
const APP_LOCK_TIMEOUT = 2 * 60 * 1000; // 2 minutes

type User = { id: string; email: string; name?: string } | null;

export type PinState = 'unknown' | 'loading' | 'no-pin' | 'locked' | 'unlocked' | 'error';

export interface PinStatus {
  hasPin: boolean;
  locked: boolean;
  lockedUntil: string | null;
  attemptsLeft?: number;
  message?: string;
  mobile?: string; // For forgot pin screen
}

type AuthState = {
  authReady: boolean;
  session: Session | null;
  user: User;
  signedIn: boolean;
  pinState: PinState;
  pinStatus: PinStatus | null;
  fingerprintEnabled: boolean;
  signIn: (user: any, access: string, refresh: string) => Promise<void>;
  signInWithFlag: (user: any, access: string, refresh: string) => Promise<void>;
  signOut: () => Promise<void>;
  checkPinStatus: () => Promise<void>;
  setPin: (pin: string, confirmPin: string) => Promise<any>;
  verifyPin: (pin: string) => Promise<any>;
  forgotPin: () => Promise<any>;
  resetPin: (otp: string, pin: string, confirmPin: string) => Promise<any>;
  lockApp: () => void;
  tryFingerprintUnlock: () => Promise<FingerprintResult>;
  setFingerprintEnabled: (enabled: boolean) => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);

// ─── CACHED ACCESS TOKEN (for authToken.ts) ─────────────
let _cachedAccessToken: string | null = null;

/**
 * Returns the in-memory cached access token set during signIn.
 * Used by authToken.ts to avoid circular dependency on the full context.
 */
export function getCachedAccessToken(): string | null {
  return _cachedAccessToken;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User>(null);
  const [pinState, setPinState] = useState<PinState>('unknown');
  const [pinStatus, setPinStatus] = useState<PinStatus | null>(null);
  const [fingerprintEnabled, setFingerprintEnabledState] = useState<boolean>(false);
  const lastActiveTimestamp = useRef<number>(Date.now());
  const isSigningIn = useRef(false);

  const handleAppStateChange = useCallback(async (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      const backgroundedTime = Date.now() - lastActiveTimestamp.current;
      let session = null;
      try {
        const result = await supabase.auth.getSession();
        session = result?.data?.session;
      } catch (e) {
        console.log('[Auth] App foreground - invalid session, ignoring:', e);
      }
      if (session && pinStatus?.hasPin && backgroundedTime > APP_LOCK_TIMEOUT) {
        lockApp();
      }
    } else if (nextAppState.match(/inactive|background/)) {
      lastActiveTimestamp.current = Date.now();
    }
  }, [pinStatus?.hasPin]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [handleAppStateChange]);

  const signOut = useCallback(async () => {
    // Clear cached access token
    _cachedAccessToken = null;
    // Also clear local PIN
    await PinApi.removeLocalPin();
    await Storage.clearFingerprintEnabled();
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setPinState('unknown');
    setPinStatus(null);
    setFingerprintEnabledState(false);
  }, []);
  
  const checkPinStatus = useCallback(async (sessionOverride?: Session | null) => {
    let currentSession = sessionOverride;
    if (!currentSession) {
      try {
        const { data: { session: fetchedSession } } = await supabase.auth.getSession();
        currentSession = fetchedSession;
      } catch (e) {
        console.log('[Auth] checkPinStatus - invalid session, treating as logged out:', e);
        currentSession = null;
      }
    }
    
    if (!currentSession) {
      setPinState('unknown');
      return;
    }

    setPinState('loading');
    
    // Try server first, fall back to local PIN check
    try {
      const response = await PinApi.status();
      
      if (response.success) {
        setPinStatus(response as PinStatus);
        if (response.hasPin) {
          setPinState('locked');
        } else {
          setPinState('no-pin');
        }
      } else {
        // Check if local PIN exists as fallback
        const hasLocal = await PinApi.hasLocalPin();
        if (hasLocal) {
          setPinStatus({ hasPin: true, locked: true, lockedUntil: null } as PinStatus);
          setPinState('locked');
        } else {
          setPinState('no-pin');
          setPinStatus({ message: response.message || 'Could not retrieve PIN status.', hasPin: false, locked: false, lockedUntil: null });
        }
        if (response.status === 401) { // Not authenticated can happen, sign out
          signOut();
        }
      }
    } catch (e) {
      // If server fails, check local PIN
      const hasLocal = await PinApi.hasLocalPin();
      if (hasLocal) {
        setPinStatus({ hasPin: true, locked: true, lockedUntil: null } as PinStatus);
        setPinState('locked');
      } else {
        setPinState('no-pin');
      }
    }
  }, [signOut]);

  // Use a ref to store the latest checkPinStatus to avoid re-running boot effect
  const checkPinStatusRef = useRef(checkPinStatus);
  checkPinStatusRef.current = checkPinStatus;

  useEffect(() => {
    let alive = true;

    async function boot() {
      try {
        let initialSession: Session | null = null;
        try {
          const { data: { session } } = await supabase.auth.getSession();
          initialSession = session;
        } catch (e) {
          // Stale/invalid refresh token - clear session and let user sign in fresh
          console.log('[Auth] Invalid session detected, clearing:', e);
          try {
            await supabase.auth.signOut();
          } catch (signOutErr) {
            console.log('[Auth] Sign out during invalid session also failed:', signOutErr);
          }
          initialSession = null;
        }
        if (!alive) return;

        // Load fingerprint preference
        const fpEnabled = await Storage.getFingerprintEnabled();
        if (alive) setFingerprintEnabledState(fpEnabled);

        setSession(initialSession);
        if (initialSession?.user) {
          setUserFromSession(initialSession);
          await checkPinStatusRef.current();
        }
      } finally {
        if (alive) setAuthReady(true);
      }
    }

    boot();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!alive) return;
      
      // Skip if we're currently signing in to avoid loop
      if (isSigningIn.current) {
        console.log('[Auth] Skipping onAuthStateChange during signIn');
        return;
      }
      
      setSession(nextSession);
      if (nextSession?.user) {
        setUserFromSession(nextSession);
        // Don't check PIN status here, wait for explicit sign-in call
      } else {
        setUser(null);
        setPinState('unknown');
        setPinStatus(null);
      }
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []); // Empty dependency array - only run once on mount

  const setUserFromSession = (session: Session) => {
    if (!session?.user) return;
    setUser({
      id: session.user.id,
      email: session.user.email || '',
      name: (session.user.user_metadata?.full_name as string) || (session.user.user_metadata?.name as string) || undefined,
    });
  };

  const signIn = async (user: any, accessToken: string, refreshToken: string) => {
    // Cache the access token for authToken.ts
    _cachedAccessToken = accessToken;
    
    const newSession = {
      access_token: accessToken,
      refresh_token: refreshToken,
      user,
    } as Session;
    
    // Set session locally first so checkPinStatus can use it
    setSession(newSession);
    if (newSession.user) {
      setUserFromSession(newSession);
    }
    
    // Set session in Supabase (may be async, so pass session directly to checkPinStatus)
    await supabase.auth.setSession(newSession);
    
    // Pass the session directly to avoid race condition with getSession()
    await checkPinStatus(newSession);
  };
  
  const signInWithFlag = async (user: any, accessToken: string, refreshToken: string) => {
    isSigningIn.current = true;
    try {
      await signIn(user, accessToken, refreshToken);
    } finally {
      // Reset flag after a short delay to allow onAuthStateChange to fire
      setTimeout(() => {
        isSigningIn.current = false;
      }, 1000);
    }
  };

  const setPin = async (pin: string, confirmPin: string) => {
    const response = await PinApi.set(pin, confirmPin);
    if (response.success) {
      setPinState('unlocked');
      setPinStatus({ ...pinStatus, hasPin: true } as PinStatus);
    }
    return response;
  };

  const verifyPin = async (pin: string) => {
    const response = await PinApi.verify(pin);
    if (response.success) {
      setPinState('unlocked');
    } else {
      setPinStatus(prev => ({ ...prev, ...response } as PinStatus));
    }
    return response;
  };
  
  const forgotPin = async () => {
    const response = await PinApi.forgot();
    if(response.success) {
      setPinStatus(prev => ({...prev, ...response} as PinStatus));
    }
    return response;
  };

  const resetPin = async (otp: string, pin: string, confirmPin: string) => {
    const response = await PinApi.reset(otp, pin, confirmPin);
    if (response.success) {
      setPinState('unlocked');
      setPinStatus(prev => ({ ...prev, hasPin: true } as PinStatus));
    }
    return response;
  };

  const lockApp = () => {
    if (pinStatus?.hasPin) {
      setPinState('locked');
    }
  };

  // ─── FINGERPRINT AUTH ─────────────────────────────────────────────
  const tryFingerprintUnlock = useCallback(async (): Promise<FingerprintResult> => {
    // Check if fingerprint hardware is available and enrolled
    const available = await isFingerprintAvailable();
    if (!available) return 'not-available';

    const result = await tryFingerprintWithRetries(3);
    if (result === 'success') {
      setPinState('unlocked');
      // Auto-enable fingerprint for future sessions
      await Storage.setFingerprintEnabled(true);
      setFingerprintEnabledState(true);
    }
    return result;
  }, []);

  const setFingerprintEnabled = useCallback(async (enabled: boolean) => {
    await Storage.setFingerprintEnabled(enabled);
    setFingerprintEnabledState(enabled);
  }, []);

  const signedIn = !!session?.user;

  const value = useMemo<AuthState>(() => ({
    authReady,
    session,
    user,
    signedIn,
    pinState,
    pinStatus,
    fingerprintEnabled,
    signIn,
    signInWithFlag,
    signOut,
    checkPinStatus,
    setPin,
    verifyPin,
    forgotPin,
    resetPin,
    lockApp,
    tryFingerprintUnlock,
    setFingerprintEnabled,
  }), [authReady, session, user, signedIn, pinState, pinStatus, fingerprintEnabled]);

  return (
    <AuthCtx.Provider value={value}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
