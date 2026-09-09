import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';


const SUPABASE_URL = 'https://oklgqelcaujxntgjyuis.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbGdxZWxjYXVqeG50Z2p5dWlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MTA0NjUsImV4cCI6MjA3NTA4NjQ2NX0.FnFcNQXGXGpsQXvR4TW1LDc23FlIBBglLhZsRdn9VV0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ─── PROFILES ───────────────────────────────────────
export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      [
        'user_id',
        'client_id',
        'full_name',
        'email',
        'mobile',
        'avatar_url',
        'address',
        'city',
        'state',
        'pincode',
        'country',
        'pan',
        'aadhaar_masked',
        'date_of_birth',
        'occupation',
        'signup_bonus_credited',
        'signup_bonus_amount',
        'signup_bonus_remaining',
        'signup_bonus_expires_at',
        'referred_by',
        'kyc_status',
        'created_at',
        'updated_at',
        // UI fields already used in this repo
        'joined_at',
        'account_status',
        'trading_level',
        'subscription_plan',
        'broker_connected',
        'profile_completion',
      ].join(',')
    )
    .eq('user_id', userId)
    .single();

  if (error) {
    // If profile doesn't exist, return null (don't throw)
    console.log('[getProfile] Profile not found, returning null');
    return null;
  }
  return data;
}

// Create a basic profile if none exists (fallback for existing users)
// Note: Currently returns null - profile data is displayed from AuthContext user data
// The backend will create profiles for new registrations
export async function createProfileIfNotExists(userId: string, userData: {
  email: string;
  full_name?: string;
  mobile?: string;
}) {
  try {
    // Check if profile already exists
    const existing = await getProfile(userId);
    if (existing) {
      console.log('[createProfileIfNotExists] Profile already exists');
      return existing;
    }
    
    // API endpoint not available - return null and use AuthContext user data
    // Profile will be created by backend on registration
    console.log('[createProfileIfNotExists] No profile, returning null (use user data from AuthContext)');
    return null;
  } catch (err) {
    // Silently return null - don't throw error
    console.log('[createProfileIfNotExists] Error, returning null:', err);
    return null;
  }
}

export async function updateProfile(
  userId: string,
  updates: {
    full_name?: string;
    mobile?: string;
    avatar_url?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    date_of_birth?: string;
    occupation?: string;
  }
) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ─── REFERRAL CODES ─────────────────────────────────
export async function getReferralCode(userId: string) {
  const { data, error } = await supabase
    .from('referral_codes')
    .select('code')
    .eq('user_id', userId)
    .single();
  
  if (error) throw error;
  return data;
}

export async function getReferralEarnings(userId: string) {
  const { data, error } = await supabase
    .from('referral_earnings')
    .select('total_earned, total_pending, successful_count, pending_count, last_credited_at')
    .eq('user_id', userId)
    .single();
  
  if (error) throw error;
  return data;
}

export async function getReferrals(userId: string, limit = 20) {
  const { data, error } = await supabase
    .from('referrals')
    .select('referee_client_id, status, reward_amount, registered_at, first_trade_at')
    .eq('referrer_user_id', userId)
    .order('registered_at', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data;
}

// ─── REFERRAL SETTINGS ────────────────────────────────
export async function getReferralSettings() {
  const { data, error } = await supabase
    .from('referral_settings')
    .select('*')
    .single();
  
  if (error) throw error;
  return data;
}
