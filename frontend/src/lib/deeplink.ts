/**
 * IndexPilotAI Deep Linking System
 * 
 * Provides:
 * - Deep link URL generation for all screens
 * - Referral link generation
 * - Social sharing functionality
 * - Deep link parsing and handling
 */

import * as Linking from 'expo-linking';
import { Share, Platform } from 'react-native';

// ============================================================
// CONFIGURATION
// ============================================================

// Base URLs
export const APP_URL = 'indexpilotai://';
export const WEB_URL = 'https://indexpilotai.com';

// Deep link scheme (must match app.json scheme)
export const DEEP_LINK_SCHEME = 'indexpilotai';


// ============================================================
// PATH DEFINITIONS
// ============================================================

export const DeepLinkPaths = {
  // Auth
  LOGIN: 'login',
  REGISTER: 'register',
  FORGOT_PASSWORD: 'forgot-password',
  PIN_SETUP: 'pin-setup',
  PIN_LOCK: 'pin-lock',
  
  // Main tabs
  HOME: 'home',
  SYMBOLS: 'symbols',
  BROKER: 'broker',
  PROFILE: 'profile',
  LOGS: 'logs',
  
  // Features
  POSITION_MONITOR: 'position-monitor',
  STRATEGIES: 'strategies',
  SUPPORT: 'support',
  
  // External
  DHAN_OAUTH: 'dhan-oauth',
} as const;

export type DeepLinkPath = typeof DeepLinkPaths[keyof typeof DeepLinkPaths];


// ============================================================
// URL BUILDERS
// ============================================================

/**
 * Build a deep link URL for navigation
 */
export function buildLink(
  path: DeepLinkPath,
  params?: Record<string, string | number>
): string {
  return Linking.createURL(path, params);
}

/**
 * Build a web URL
 */
export function buildWebLink(
  path: string,
  params?: Record<string, string | number>
): string {
  let url = `${WEB_URL}/${path}`;
  if (params) {
    const query = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join('&');
    url += `?${query}`;
  }
  return url;
}


// ============================================================
// CONVENIENCE LINK GETTERS
// ============================================================

// Auth links
export const getLoginUrl = () => buildLink(DeepLinkPaths.LOGIN);
export const getRegisterUrl = (ref?: string) => buildLink(DeepLinkPaths.REGISTER, ref ? { ref } : undefined);
export const getForgotPasswordUrl = () => buildLink(DeepLinkPaths.FORGOT_PASSWORD);

// Tab links
export const getHomeUrl = () => buildLink(DeepLinkPaths.HOME);
export const getSymbolsUrl = () => buildLink(DeepLinkPaths.SYMBOLS);
export const getBrokerUrl = () => buildLink(DeepLinkPaths.BROKER);
export const getProfileUrl = () => buildLink(DeepLinkPaths.PROFILE);
export const getLogsUrl = () => buildLink(DeepLinkPaths.LOGS);

// Feature links
export const getPositionMonitorUrl = () => buildLink(DeepLinkPaths.POSITION_MONITOR);
export const getStrategiesUrl = () => buildLink(DeepLinkPaths.STRATEGIES);
export const getSupportUrl = () => buildLink(DeepLinkPaths.SUPPORT);
export const getDhanOAuthUrl = () => buildLink(DeepLinkPaths.DHAN_OAUTH);


// ============================================================
// REFERRAL LINKS
// ============================================================

/**
 * Generate referral link with code
 */
export function getReferralLink(referralCode: string): string {
  return buildWebLink('register', { ref: referralCode.toUpperCase() });
}

/**
 * Generate deep link for referral
 */
export function getReferralDeepLink(referralCode: string): string {
  return buildLink(DeepLinkPaths.REGISTER, { ref: referralCode.toUpperCase() });
}


// ============================================================
// SHARING
// ============================================================

/**
 * Native share using React Native Share
 */
export async function shareContent(
  message: string,
  url?: string
): Promise<void> {
  try {
    const content = url 
      ? { message: `${message}\n\n${url}` } as { message: string }
      : { message };
    
    await Share.share(content);
  } catch (err) {
    console.error('[DeepLink] Share failed:', err);
  }
}

/**
 * Share the app with friends
 */
export async function shareAppLink(message?: string): Promise<void> {
  const msg = message || 'Check out IndexPilotAI - Your Trading Companion';
  await shareContent(msg, WEB_URL);
}

/**
 * Share referral link
 */
export async function shareReferral(referralCode: string): Promise<void> {
  const link = getReferralLink(referralCode);
  const msg = `Join IndexPilotAI! Use my referral code: ${referralCode}`;
  await shareContent(msg, link);
}

/**
 * Share position trade
 */
export async function sharePositionTrade(data: {
  symbol: string;
  entry: number;
  current: number;
  pnl: number;
  pnlPercent: number;
}): Promise<void> {
  const emoji = data.pnl >= 0 ? '📈' : '📉';
  const msg = `${emoji} ${data.symbol}: Entry ₹${data.entry} | Current ₹${data.current}\nP&L: ₹${data.pnl.toFixed(2)} (${data.pnlPercent.toFixed(2)}%)`;
  await shareContent(msg, WEB_URL);
}

/**
 * Share trading signal
 */
export async function shareTradingSignal(data: {
  index: string;
  action: string;
  entry: number;
  target: number;
  stopLoss: number;
}): Promise<void> {
  const emoji = data.action === 'BUY' ? '✅' : '❌';
  const msg = `${emoji} ${data.index} ${data.action}\nEntry: ₹${data.entry} | Target: ₹${data.target} | SL: ₹${data.stopLoss}`;
  await shareContent(msg, WEB_URL);
}

/**
 * Share order notification
 */
export async function shareOrderNotification(data: {
  symbol: string;
  action: string;
  price: number;
  quantity: number;
}): Promise<void> {
  const msg = `🎯 ${data.action} ${data.symbol}: ${data.quantity} @ ₹${data.price}`;
  await shareContent(msg, WEB_URL);
}


// ============================================================
// DEEP LINK PARSING
// ============================================================

/**
 * Parse a deep link URL
 */
export function parseLink(url: string): {
  path: string;
  params: Record<string, string>;
} | null {
  try {
    const parsed = Linking.parse(url);
    return {
      path: parsed.path || '',
      params: (parsed.queryParams as Record<string, string>) || {},
    };
  } catch {
    return null;
  }
}

/**
 * Map path to screen route
 */
export function resolveRoute(url: string): string | null {
  const parsed = parseLink(url);
  if (!parsed) return null;
  
  const path = parsed.path.toLowerCase();
  const routes: Record<string, string> = {
    login: '/(auth)/login',
    register: '/(auth)/register',
    'forgot-password': '/(auth)/forgot-password',
    'pin-setup': '/(auth)/pin-setup',
    'pin-lock': '/(auth)/pin-lock',
    home: '/(tabs)/home',
    symbols: '/(tabs)/symbols',
    broker: '/(tabs)/broker',
    profile: '/(tabs)/profile',
    logs: '/(tabs)/logs',
    'position-monitor': '/(tabs)/position-monitor',
    strategies: '/(tabs)/strategies',
    support: '/(tabs)/support',
  };
  
  return routes[path] || null;
}


// ============================================================
// UTILITIES
// ============================================================

/**
 * Open URL in browser
 */
export async function openUrl(url: string): Promise<boolean> {
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Open app settings
 */
export async function openSettings(): Promise<boolean> {
  return openUrl('indexpilotai://settings');
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    const { setStringAsync } = await import('expo-clipboard');
    await setStringAsync(text);
  } catch {
    // Try alternative import
    const { setString } = await import('expo-clipboard');
    await setString(text);
  }
}


// ============================================================
// EXPORT ALL LINKS
// ============================================================

export const DeepLinks = {
  // Auth
  login: getLoginUrl,
  register: getRegisterUrl,
  forgotPassword: getForgotPasswordUrl,
  
  // Tabs
  home: getHomeUrl,
  symbols: getSymbolsUrl,
  broker: getBrokerUrl,
  profile: getProfileUrl,
  logs: getLogsUrl,
  
  // Features
  positionMonitor: getPositionMonitorUrl,
  strategies: getStrategiesUrl,
  support: getSupportUrl,
  dhanOAuth: getDhanOAuthUrl,
  
  // Web
  website: WEB_URL,
  referral: getReferralLink,
};

export default DeepLinks;
