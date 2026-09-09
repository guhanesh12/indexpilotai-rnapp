/**
 * Firebase Cloud Messaging (FCM) Push Notifications for IndexPilotAI
 * 
 * Uses @react-native-firebase/messaging and @notifee/react-native
 * for reliable push notifications in production builds.
 * 
 * Features:
 * - Foreground notifications (when app is open)
 * - Background notifications (when app is minimized)  
 * - Quit/killed notifications (via Notifee)
 * - Token refresh handling
 * - Deep link on tap
 * - Real-time screen notifications on physical device
 */
import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';
import { api } from './api';
import { Storage } from './storage';

// Firebase imports - only available in native builds (Expo Go will skip these)
let messaging: any = null;
let notifee: any = null;
let AndroidImportance: any = null;
let EventType: any = null;

// Try to load Firebase modules (gracefully skip if not available)
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const messagingModule = require('@react-native-firebase/messaging');
  messaging = messagingModule.default || messagingModule;
  // eslint-disable-next-line @typescript-eslint/no-require-imports  
  const notifeeModule = require('@notifee/react-native');
  notifee = notifeeModule.default || notifeeModule;
  // Use fallback values for AndroidImportance in case minification strips the enum
  AndroidImportance = notifee.AndroidImportance || {
    NONE: 0,
    MIN: 1,
    LOW: 2,
    DEFAULT: 3,
    HIGH: 4,
    MAX: 5,
    UNSPECIFIED: -1000,
  };
  EventType = notifee.EventType || {
    UNKNOWN: 0,
    DISMISSED: 1,
    PRESS: 2,
    ACTION_PRESS: 3,
    DELIVERED: 4,
    APP_BLOCKED: 5,
    CHANNEL_BLOCKED: 6,
    CHANNEL_GROUP_BLOCKED: 7,
    FOREGROUND: 8,
  };
} catch (e) {
  // Firebase not available - running in Expo Go or web
  console.log('[FCM] Firebase modules not available in this build environment');
}

// Supabase Edge Function endpoints
const SUPABASE_URL = 'https://api.indexpilotai.com/functions/v1/make-server-c4d79cb7';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbGdxZWxjYXVqeG50Z2p5dWlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MTA0NjUsImV4cCI6MjA3NTA4NjQ2NX0.FnFcNQXGXGpsQXvR4TW1LDc23FlIBBglLhZsRdn9VV0';

// Notifee channel IDs
const CHANNEL_IDS = {
  default: 'indexpilot_default',
  signals: 'indexpilot_signals',
  orders: 'indexpilot_orders',
  wallet: 'indexpilot_wallet',
};

// Track registration state per user
let registeredForUser: string | null = null;

// Notification event emitter for in-app display
type NotificationHandler = (title: string, body: string, data?: Record<string, string>) => void;
let _foregroundHandlers: NotificationHandler[] = [];

/**
 * Get channel ID for a notification type
 */
function getChannelId(channel: string): string {
  const channelMap: Record<string, string> = {
    default: CHANNEL_IDS.default,
    signals: CHANNEL_IDS.signals,
    orders: CHANNEL_IDS.orders,
    wallet: CHANNEL_IDS.wallet,
    signal: CHANNEL_IDS.signals,
    order: CHANNEL_IDS.orders,
    alert: CHANNEL_IDS.wallet,
    ticket: CHANNEL_IDS.default,
  };
  return channelMap[channel.toLowerCase()] || CHANNEL_IDS.default;
}

/**
 * Create all notification channels for Android (required for Android 8+)
 */
async function createNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  
  try {
    const channels = [
      {
        id: CHANNEL_IDS.default,
        name: 'All Notifications',
        importance: AndroidImportance?.HIGH || 4,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7C5CFF',
      },
      {
        id: CHANNEL_IDS.signals,
        name: 'AI Trading Signals',
        importance: AndroidImportance?.MAX || 5,
        vibrationPattern: [0, 100, 50, 100],
        lightColor: '#00FF66',
      },
      {
        id: CHANNEL_IDS.orders,
        name: 'Orders & Positions',
        importance: AndroidImportance?.MAX || 5,
        vibrationPattern: [0, 200, 100, 200],
        lightColor: '#00B4FF',
      },
      {
        id: CHANNEL_IDS.wallet,
        name: 'Wallet & Funds',
        importance: AndroidImportance?.HIGH || 4,
        vibrationPattern: [0, 150, 100, 150],
        lightColor: '#FFB800',
      },
    ];

    for (const ch of channels) {
      try {
        await notifee.createChannel(ch);
        console.log(`[FCM] Channel '${ch.name}' created`);
      } catch (e) {
        console.log(`[FCM] Channel '${ch.name}' create error:`, e);
      }
    }
    
    console.log('[FCM] All notification channels created');
  } catch (e) {
    console.log('[FCM] Channel creation error:', e);
  }
}

/**
 * Request push notification permissions
 * Uses multiple methods for maximum reliability on Android 13+:
 * 1. expo-notifications (most reliable for Expo projects)
 * 2. Android PermissionsAndroid API
 * 3. FCM's native requestPermission
 */
async function requestPermission(): Promise<boolean> {
  // METHOD 1: Try expo-notifications (most reliable for Expo SDK)
  // Skip in Expo Go SDK 53+ where this module is removed
  try {
    let Notifications: any = null;
    try {
      // Check if we're in Expo Go by trying to detect the environment
      // In Expo Go SDK 53+, require('expo-notifications') throws an error
      // Use a try/catch with a flag to avoid the error
      const isExpoGo = typeof globalThis !== 'undefined' && 
        globalThis.expo?.modules?.some?.((m: any) => m?.name === 'ExpoGo') === true;
      
      if (isExpoGo) {
        console.log('[FCM] Detected Expo Go, skipping expo-notifications (removed in SDK 53+)');
      } else {
        // Use dynamic import pattern to avoid static analysis errors
        Notifications = require('expo-notifications');
      }
    } catch (moduleError) {
      // Module not available in this environment (Expo Go SDK 53+ removes it)
      console.log('[FCM] expo-notifications module not available in this environment');
    }
    
    if (Notifications?.requestPermissionsAsync) {
      console.log('[FCM] Requesting via expo-notifications...');
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
        android: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      console.log('[FCM] expo-notifications permission result:', status);
      if (status === 'granted') {
        console.log('[FCM] Permission granted via expo-notifications');
        return true;
      }
    }
  } catch (e: any) {
    // Expo Go SDK 53+ throws errors instead of returning denied - catch gracefully
    console.log('[FCM] expo-notifications permission request failed (expected in Expo Go):', e?.message || '');
  }
  
  // METHOD 2: Android native PermissionsAndroid (reliable for Android 13+)
  if (Platform.OS === 'android') {
    try {
      const apiLevel = Platform.Version;
      console.log('[FCM] Android API level:', apiLevel);
      
      // Android 13 (API 33) and above needs POST_NOTIFICATIONS
      if (apiLevel as number >= 33) {
        console.log('[FCM] Requesting via PermissionsAndroid...');
        const result = await PermissionsAndroid.request(
          'android.permission.POST_NOTIFICATIONS' as any,
          {
            title: 'IndexPilot AI Notifications',
            message: 'IndexPilot AI needs notification permission to send you trade alerts, signals, and account updates.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          }
        );
        
        console.log('[FCM] Android permission result:', result);
        
        if (result === PermissionsAndroid.RESULTS.GRANTED) {
          console.log('[FCM] Android POST_NOTIFICATIONS granted via PermissionsAndroid');
          return true;
        } else {
          console.log('[FCM] Android POST_NOTIFICATIONS denied via PermissionsAndroid');
        }
      } else {
        // Pre-Android 13 - no runtime permission needed, permission is granted at install time
        console.log('[FCM] Android < 13, no runtime permission needed');
        return true;
      }
    } catch (error) {
      console.log('[FCM] Android PermissionsAndroid error:', error);
    }
  }
  
  // METHOD 3: FCM's native requestPermission (works in some builds)
  if (messaging) {
    try {
      console.log('[FCM] Requesting FCM permission...');
      const settings = await messaging().requestPermission();
      
      const AuthStatus = messaging.AuthorizationStatus;
      if (settings === AuthStatus.AUTHORIZED || settings === AuthStatus.PROVISIONAL) {
        console.log('[FCM] FCM Permission granted');
        return true;
      }
      
      console.log('[FCM] FCM Permission denied:', settings);
    } catch (error) {
      console.log('[FCM] FCM Permission error:', error);
    }
  } else {
    console.log('[FCM] Firebase not available, skipping FCM permission');
    // On Android < 13, permission is granted at install time
    if (Platform.OS === 'android') {
      const apiLevel = Platform.Version as number;
      if (apiLevel < 33) return true;
    }
  }
  
  // All methods failed - permission was denied
  console.log('[FCM] All permission request methods failed');
  return false;
}

/**
 * Register device token with backend
 */
async function registerToken(userId: string, accessToken?: string): Promise<void> {
  if (!messaging) {
    console.log('[FCM] Firebase not available, skipping token registration');
    return;
  }
  
  try {
    const token = await messaging().getToken();
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('FCM TOKEN:', token);
    console.log('FOR BACKEND USE: Use this token in send.js');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Store locally
    await Storage.setFcmToken(token);
    console.log('[FCM] Token stored locally');
    
    // Register with Supabase backend
    const supabaseRes = await fetch(`${SUPABASE_URL}/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        userId,
        deviceToken: token,
        platform: Platform.OS,
        browser: 'ReactNative',
        device: `${Platform.OS} ${Platform.Version}`,
      }),
    });
    
    const supabaseData = await supabaseRes.json();
    console.log('[FCM] Supabase registration response:', JSON.stringify(supabaseData));
    
    // Also register with backend server (MongoDB) for automatic notifications
    try {
      const backendUrl = 'https://api.indexpilotai.com';
      const backendRes = await fetch(`${backendUrl}/push/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token,
          platform: Platform.OS,
          user_id: userId,
        }),
      });
      
      const backendData = await backendRes.json();
      console.log('[FCM] Backend registration response:', JSON.stringify(backendData));
    } catch (backendError) {
      console.log('[FCM] Backend registration error:', backendError);
    }
    
    console.log('[FCM] Token registered with backends');
  } catch (error) {
    console.log('[FCM] Token registration error:', error);
  }
}

/**
 * Main function to register for push notifications
 * Call this after successful login with userId and accessToken
 */
export async function registerPush(userId: string, accessToken?: string): Promise<void> {
  if (registeredForUser === userId) {
    console.log('[FCM] Already registered for user:', userId, 'skipping');
    return;
  }
  
  console.log('[FCM] Starting push registration for user:', userId);
  
  // Create notification channels
  await createNotificationChannels();
  
  // Request permission
  const hasPermission = await requestPermission();
  if (!hasPermission) {
    console.log('[FCM] Permission not granted');
    return;
  }
  
  // Register token
  await registerToken(userId, accessToken);
  
  // Set up token refresh listener (modern API - onToken instead of deprecated onTokenRefresh)
  if (messaging) {
    try {
      // Modern API: onToken (replaces deprecated onTokenRefresh)
      if (typeof messaging().onToken === 'function') {
        messaging().onToken(async (newToken: string) => {
          console.log('[FCM] Token refreshed (onToken):', newToken.substring(0, 20) + '...');
          await Storage.setFcmToken(newToken);
          // Re-register with backends
          try {
            await fetch(`${SUPABASE_URL}/push/subscribe`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                apikey: ANON_KEY,
                ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
              },
              body: JSON.stringify({
                userId,
                deviceToken: newToken,
                platform: Platform.OS,
              }),
            });
          } catch {}
        });
      } else {
        // Fallback to legacy onTokenRefresh
        messaging().onTokenRefresh(async (newToken: string) => {
          console.log('[FCM] Token refreshed (legacy):', newToken.substring(0, 20) + '...');
          await Storage.setFcmToken(newToken);
        });
      }
    } catch (e) {
      console.log('[FCM] Token refresh listener setup error:', e);
    }
  }
  
  registeredForUser = userId;
  console.log('[FCM] Push registration complete for user:', userId);
}

/**
 * Display foreground notification using Notifee
 * Called when app is in foreground and message received
 */
export async function displayForegroundNotification(
  title: string,
  body: string,
  data?: Record<string, string>,
  channel?: string
): Promise<void> {
  if (!notifee) {
    console.log('[FCM] Notifee not available, cannot display notification:', title);
    return;
  }
  
  try {
    await notifee.displayNotification({
      title,
      body,
      android: {
        channelId: getChannelId(channel || 'default'),
        importance: AndroidImportance.HIGH,
        pressAction: { id: 'default' },
        ...(data?.largeIcon ? { largeIcon: data.largeIcon } : {}),
      },
      ios: {
        ...(data?.attachmentUrl ? { attachments: [{ url: data.attachmentUrl }] } : {}),
      },
      data: data,
    });
    
    console.log('[FCM] Foreground notification displayed:', title);
  } catch (error) {
    console.log('[FCM] Display error:', error);
  }
}

/**
 * Set up foreground message handler
 * Call this in app/_layout.tsx to handle messages when app is open
 */
export function onForegroundMessage(handler: NotificationHandler): () => void {
  if (!messaging) {
    console.log('[FCM] Firebase not available, skipping foreground handler');
    return () => {};
  }
  
  // Add to handler list
  _foregroundHandlers.push(handler);
  
  const unsubscribe = messaging().onMessage(async (remoteMessage: any) => {
    const notification = remoteMessage.notification;
    const title = notification?.title || '';
    const body = notification?.body || '';
    const data = remoteMessage.data as Record<string, string> | undefined;
    const channel = data?.channel || 'default';
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📬 FOREGROUND NOTIFICATION:');
    console.log('  Title:', title);
    console.log('  Body:', body);
    console.log('  Data:', JSON.stringify(data));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Display using Notifee (shows even when app is open)
    await displayForegroundNotification(title, body, data, channel);
    
    // Call all custom handlers
    for (const h of _foregroundHandlers) {
      try { h(title, body, data); } catch {}
    }
  });
  
  return unsubscribe;
}

/**
 * Set up background message handler
 * Call this BEFORE AppRegistry.registerComponent in index.js
 */
export async function setupBackgroundHandler(): Promise<void> {
  if (!messaging || !notifee) {
    console.log('[FCM] Firebase not available, skipping background handler');
    return;
  }
  
  // Set background handler for when app is quit/killed
  messaging().setBackgroundMessageHandler(async (remoteMessage: any) => {
    const notification = remoteMessage.notification;
    const title = notification?.title || '';
    const body = notification?.body || '';
    const data = remoteMessage.data as Record<string, string> | undefined;
    const channel = data?.channel || 'default';
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📬 BACKGROUND NOTIFICATION:');
    console.log('  Title:', title);
    console.log('  Body:', body);
    console.log('  Data:', JSON.stringify(data));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Display notification using Notifee
    await notifee.displayNotification({
      title,
      body,
      android: {
        channelId: getChannelId(channel),
        importance: AndroidImportance.HIGH,
        pressAction: { id: 'default' },
      },
      data: data,
    });
  });
  
  console.log('[FCM] Background handler set');
}

/**
 * Handle notification tap for deep linking
 * Call this to navigate based on notification data
 */
function normalizeNotificationData(data: any): Record<string, string> | undefined {
  if (!data) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue;
    out[k] = typeof v === 'string' ? v : String(v);
  }
  return out;
}

function resolveRouteFromPayload(payload: Record<string, string> | undefined): string {
  const url = payload?.url?.trim();
  const event = payload?.event?.trim();
  const type = payload?.type?.trim();

  // Trailing notifications → navigate to Home/Dashboard (trailing card is there)
  if (type === 'TRAILING_ACTIVATED' || type === 'TRAILING_STEP') {
    return '/(tabs)/home';
  }

  // Primary: server contract says data.url (e.g. "/wallet", "/orders", "/positions", "/")
  if (url) {
    // Map backend url -> expo-router route
    const u = url.toLowerCase();
    if (u === '/' || u === '/dashboard') return '/(tabs)/home';
    if (u === '/wallet' || u === '/orders' || u === '/signals') return '/(tabs)/home';
    if (u === '/positions') return '/(tabs)/position-monitor';
    if (u === '/profile') return '/(tabs)/profile';
    if (u === '/support') return '/(tabs)/support';
    return '/(tabs)/home';
  }

  // Fallback: event mapping (old contract / compatibility)
  if (event) {
    const ev = event.toUpperCase();
    switch (ev) {
      case 'ENGINE_ON':
      case 'ENGINE_OFF':
        return '/(tabs)/home';
      case 'POSITION_CLOSED_PROFIT':
      case 'POSITION_CLOSED_LOSS':
        return '/(tabs)/position-monitor';
      case 'ORDER_PLACED':
      case 'SIGNAL_GENERATED':
      case 'WALLET_CREDIT':
      case 'WALLET_DEBIT':
        return '/(tabs)/home';
      case 'ADMIN_BROADCAST':
        return '/(tabs)/home';
      default:
        return '/(tabs)/home';
    }
  }

  return '/(tabs)/home';
}

export async function onNotificationTap(
  onNavigate: (path: string, data: Record<string, string>) => void
): Promise<void> {
  if (!notifee || !EventType) {
    console.log('[FCM] Notifee not available, skipping notification tap handler');
    return;
  }

  // Foreground/tap on Notifee-displayed notifications
  notifee.onForegroundEvent(async ({ type, detail }: { type: any; detail: any }) => {
    if (type !== EventType.PRESS) return;

    const data = normalizeNotificationData(detail?.notification?.data);
    const path = resolveRouteFromPayload(data);

    console.log('[FCM] Notifee press navigation:', { path, data });
    if (data) onNavigate(path, data);
  });
}

export async function setupNotificationOpenedHandlers(
  onNavigate: (path: string, data: Record<string, string>) => void
): Promise<void> {
  if (!messaging) {
    console.log('[FCM] Firebase not available, skipping onNotificationOpenedApp/initial handlers');
    return;
  }

  // App in background -> user taps notification
  messaging().onNotificationOpenedApp((remoteMessage: any) => {
    const payload = normalizeNotificationData(remoteMessage?.data) || {};
    const path = resolveRouteFromPayload(payload);
    console.log('[FCM] onNotificationOpenedApp navigation:', { path, payload });
    onNavigate(path, payload);
  });

  // App in quit state -> user taps notification when launching app
  try {
    const initial = await messaging().getInitialNotification();
    if (initial) {
      const payload = normalizeNotificationData(initial?.data) || {};
      const path = resolveRouteFromPayload(payload);
      console.log('[FCM] getInitialNotification navigation:', { path, payload });
      onNavigate(path, payload);
    }
  } catch (e) {
    console.log('[FCM] getInitialNotification error:', e);
  }
}

/**
 * Initialize FCM on app startup (non-blocking)
 * Call this in app/_layout.tsx
 * Requests notification permission on Android 13+ at app launch
 */
export async function initializeFCM(): Promise<void> {
  if (!messaging) {
    console.log('[FCM] Firebase not available, skipping initialization');
    return;
  }
  
  // Create notification channels immediately
  await createNotificationChannels();
  
  // Request notification permission on app launch (Android 13+)
  // This shows the system permission dialog immediately when app starts
  try {
    const hasPermission = await requestPermission();
    if (hasPermission) {
      console.log('[FCM] Permission granted during init');
      
      // Try to get token since we have permission now
      try {
        const token = await messaging().getToken();
        if (token) {
          console.log('[FCM] Token available:', token);
          console.log('[FCM] FULL_TOKEN:' + token);
          // Store token locally
          await Storage.setFcmToken(token);
        }
      } catch (tokenError) {
        console.log('[FCM] Token not available during init:', tokenError);
      }
    } else {
      console.log('[FCM] Permission not granted during init');
      // Try to get existing token anyway (might have been granted in previous session)
      try {
        const token = await messaging().getToken();
        if (token) {
          console.log('[FCM] Existing token available:', token);
          await Storage.setFcmToken(token);
        }
      } catch {
        // Ignore - permission not granted
      }
    }
  } catch (e) {
    console.log('[FCM] Permission request error during init:', e);
  }
  
  // Set up foreground handler
  onForegroundMessage((title, body, data) => {
    console.log('[FCM] Notification received:', title, body);
  });
}

/**
 * Get current FCM token
 */
export async function getFCMToken(): Promise<string | null> {
  if (!messaging) {
    return null;
  }
  
  try {
    return await messaging().getToken();
  } catch {
    return null;
  }
}

/**
 * Send a test notification to verify push is working
 * This sends a local notification via Notifee to test the display
 */
export async function sendTestLocalNotification(): Promise<boolean> {
  if (!notifee) {
    console.log('[FCM] Notifee not available, cannot send test notification');
    return false;
  }
  
  try {
    await notifee.displayNotification({
      title: '🔔 Test Notification',
      body: 'Push notifications are working on your device!',
      android: {
        channelId: CHANNEL_IDS.default,
        importance: AndroidImportance.MAX,
        pressAction: { id: 'default' },
      },
      ios: {
        sound: 'default',
      },
    });
    console.log('[FCM] Test local notification sent successfully');
    return true;
  } catch (error) {
    console.log('[FCM] Test notification error:', error);
    return false;
  }
}

/**
 * Send notifications for all event types to test the full flow
 */
export async function sendTestAllNotifications(): Promise<void> {
  if (!notifee) {
    console.log('[FCM] Notifee not available');
    return;
  }
  
  const testNotifications = [
    { title: '📈 New AI Signal', body: 'BUY NIFTY 23500 CE - Target: 23700', channel: CHANNEL_IDS.signals },
    { title: '✅ Order Placed', body: 'Order #12345 placed successfully', channel: CHANNEL_IDS.orders },
    { title: '✅ Order Executed', body: 'Order executed at ₹23550', channel: CHANNEL_IDS.orders },
    { title: '💰 Wallet Recharged', body: '₹5,000 added to your wallet', channel: CHANNEL_IDS.wallet },
    { title: '📊 Signal Exited', body: 'NIFTY signal exited with +₹1,250 profit', channel: CHANNEL_IDS.signals },
    { title: '🎫 Support Ticket', body: 'Ticket #9876 has been resolved', channel: CHANNEL_IDS.default },
    { title: '🎯 Trade Executed', body: 'BUY 1 lot NIFTY @ ₹23500', channel: CHANNEL_IDS.orders },
    { title: '💬 Support Update', body: 'Agent responded to your ticket', channel: CHANNEL_IDS.default },
    { title: '⚠️ Low Balance', body: 'Your wallet balance is below ₹1,000', channel: CHANNEL_IDS.wallet },
    { title: '🔔 Alert', body: 'Market is opening in 5 minutes', channel: CHANNEL_IDS.default },
  ];
  
  console.log('[FCM] Sending', testNotifications.length, 'test notifications...');
  
  for (let i = 0; i < testNotifications.length; i++) {
    const n = testNotifications[i];
    try {
      await notifee.displayNotification({
        title: n.title,
        body: n.body,
        android: {
          channelId: n.channel,
          importance: AndroidImportance.MAX,
          pressAction: { id: 'default' },
        },
        ios: {
          sound: 'default',
        },
      });
      console.log(`[FCM] Test ${i + 1}/${testNotifications.length}:`, n.title);
    } catch (e) {
      console.log(`[FCM] Test ${i + 1} error:`, e);
    }
  }
  
  console.log('[FCM] All test notifications sent!');
}
