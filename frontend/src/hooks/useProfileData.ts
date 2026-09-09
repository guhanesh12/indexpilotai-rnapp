import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { request, NotSignedInError } from '../lib/api';
import { getBrokerStatus } from '../api/broker';

const DEFAULT_PREFS = {
  email_enabled: false,
  push_enabled: true,
  sms_enabled: false,
  whatsapp_enabled: false,
  trade_alerts: true,
};

type NotificationPrefs = {
  user_id: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  push_enabled: boolean;
  trade_alerts: boolean;
};

type Wallet = {
  balance: number;
  totalProfit: number;
  totalDeducted: number;
  lastUpdated: string;
};

type Profile = {
  user_id: string;
  client_id: string;
  email: string;
  full_name: string;
  mobile: string;
  photo_url: string | null;
  kyc_status: 'pending' | 'verified' | 'rejected' | null;
  account_status: string | null;
  role: string | null;
  broker_connected: boolean;
  welcome_popup_seen: boolean;
  tour_completed: boolean;
  profile_completion: number;
  signup_bonus_credited: boolean;
  signup_bonus_amount: number;
  signup_bonus_remaining: number;
  signup_bonus_expires_at: string | null;
  referred_by: string | null;
  created_at: string;
  updated_at: string;
};

type Earnings = {
  total_earned: number;
  total_pending: number;
  successful_count: number;
  pending_count: number;
};

type Referral = {
  referee_user_id: string;
  referee_name: string;
  status: string;
  reward_amount: number;
  created_at: string;
};

type ProfileMeResponse = {
  profile: Profile;
  referralCode: string;
  earnings: Earnings;
};

// Unified loader used by the three existing hooks to minimize UI changes.
function useProfileScreenData() {
  const { authReady, session, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [referredUsers, setReferredUsers] = useState<Referral[]>([]);
  const [broker, setBroker] = useState<any>(null);
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);

  const load = useCallback(async () => {
    if (!authReady) {
      setLoading(true);
      return;
    }

    // CRITICAL: do not call profile/wallet/referral/broker/notification APIs until auth hydration is complete.
    if (!user || !session) {
      setLoading(false);
      setError('NOT_SIGNED_IN');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [meRes, walletRes, refsRes, brokerRes, prefsRes] = await Promise.all([
        // Profile
        request<any>('GET', '/profile/me', undefined, session.access_token).catch((err: unknown) => {
          const e = err as Error;
          if (e instanceof NotSignedInError) throw e;
          console.warn('[ProfileScreen] /profile/me failed:', e?.message || e);
          return null;
        }),
        // Wallet
        request<any>('GET', '/wallet/balance', undefined, session.access_token).catch((err: unknown) => {
          const e = err as Error;
          if (e instanceof NotSignedInError) throw e;
          console.warn('[ProfileScreen] wallet/balance failed:', e?.message || e);
          return { balance: 0, totalProfit: 0, totalDeducted: 0, lastUpdated: '' } as Wallet;
        }),
        // Referral
        request<any>('GET', '/referral/my', undefined, session.access_token).catch((err: unknown) => {
          const e = err as Error;
          if (e instanceof NotSignedInError) throw e;
          console.warn('[ProfileScreen] referral/my failed:', e?.message || e);
          return { referrals: [], earnings: { total_earned: 0, total_pending: 0, successful_count: 0, pending_count: 0 } };
        }),
        // Broker status (passive, safe for profile load)
        getBrokerStatus(session).catch((err: unknown) => {
          const e = err as Error;
          if (e instanceof NotSignedInError) throw e;
          console.warn('[ProfileScreen] broker status non-fatal:', e?.message || e);
          return { connected: false, broker: 'dhan', status: 'not_connected', daysLeft: 0 };
        }),
        // Notification preferences
        (async (): Promise<NotificationPrefs> => {
          try {
            const r = await supabase
              .from('notification_preferences')
              .select('*')
              .eq('user_id', user.id)
              .maybeSingle();
            return (r.data || { user_id: user.id, ...DEFAULT_PREFS }) as NotificationPrefs;
          } catch {
            return { user_id: user.id, ...DEFAULT_PREFS } as NotificationPrefs;
          }
        })(),
      ]);

      setProfile(meRes?.profile ?? null);
      setReferralCode(meRes?.referralCode ?? null);
      setEarnings(meRes?.earnings ?? refsRes?.earnings ?? null);
      setWallet(walletRes || null);
      setReferredUsers(refsRes?.referrals || []);
      setBroker(brokerRes || null);
      setPrefs(prefsRes || null);
    } catch (e: unknown) {
      const err = e as Error;
      console.error('[ProfileScreen] load() failed:', err);
      setError(err?.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [authReady, session, user]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    loading,
    error,
    profile,
    wallet,
    referralCode,
    earnings,
    referredUsers,
    broker,
    prefs,
    refresh: load,
  };
}

export function useProfile() {
  const data = useProfileScreenData();
  return { profile: data.profile as any, loading: data.loading, error: data.error, refresh: data.refresh };
}

export function useWallet() {
  const data = useProfileScreenData();
  return { wallet: data.wallet as any, loading: data.loading, error: data.error, refresh: data.refresh };
}

export function useReferral() {
  const data = useProfileScreenData();

  return {
    code: data.referralCode ? { code: data.referralCode } : null,
    earnings: data.earnings
      ? {
          total_earned: data.earnings.total_earned,
          successful_count: data.earnings.successful_count,
        }
      : null,
    referredUsers: data.referredUsers as any,
    loading: data.loading,
    error: data.error,
    refresh: data.refresh,
  };
}

