/**
 * Firebase Push Notifications setup for IndexPilotAI.
 * 
 * Production-ready FCM setup for physical device testing.
 * Notifications work in foreground, background, and when app is killed.
 * 
 * IMPORTANT:
 *   - Real push delivery only works in EAS Dev/Preview/Production builds.
 *   - In Expo Go (SDK 53+), expo-notifications throws on import → we lazy-load
 *     it ONLY when not in Expo Go to avoid crashing the bundle.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { api } from './api';
import { Storage } from './storage';

const isExpoGo = typeof globalThis !== 'undefined' && 
  globalThis.expo?.modules?.some?.((m: any) => m?.name === 'ExpoGo') === true;
const canUsePush = Platform.OS !== 'web' && !isExpoGo;

let registered = false;

/**
 * Register for push notifications and get both Expo Push Token AND FCM Token.
 * Logs tokens to console in terminal-friendly format for extraction.
 */
export async function registerForPushNotifications(): Promise<{ expoToken: string | null; fcmToken: string | null }> {
  if (registered) return { expoToken: null, fcmToken: null };
  if (!canUsePush) {
    console.log('[Push] Skipped — Expo Go or web (no native FCM/APNs)');
    return { expoToken: null, fcmToken: null };
  }

  let expoPushToken: string | null = null;
  let fcmDeviceToken: string | null = null;

  try {
    // Lazy-load the modules inside the function so Expo Go never resolves them
    const Notifications = await import('expo-notifications');
    const Device = await import('expo-device');

    // Foreground behavior (set once)
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }) as any,
    });

    if (!Device.isDevice) {
      console.log('[Push] Skipped — emulator/simulator not supported');
      return { expoToken: null, fcmToken: null };
    }

    // Permissions
    const { status: existing } = await Notifications.getPermissionsAsync();
    let final = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      final = status;
    }
    if (final !== 'granted') {
      console.log('[Push] Permission DENIED');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('NOTIFICATION PERMISSION: DENIED');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return { expoToken: null, fcmToken: null };
    }

    console.log('[Push] Permission GRANTED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('NOTIFICATION PERMISSION: GRANTED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Android channels (required for Android 8+)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Trading Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7C5CFF',
      });
      await Notifications.setNotificationChannelAsync('signals', {
        name: 'AI Signals',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 100, 50, 100],
        lightColor: '#00FF66',
      });
      await Notifications.setNotificationChannelAsync('orders', {
        name: 'Orders & Positions',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 200, 100, 200],
        lightColor: '#00B4FF',
      });
      await Notifications.setNotificationChannelAsync('wallet', {
        name: 'Wallet & Funds',
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: '#FFB800',
      });
    }

    // ========================================
    // GET EXPO PUSH TOKEN
    // ========================================
    try {
      const expoTokenData = await Notifications.getExpoPushTokenAsync();
      expoPushToken = expoTokenData?.data || null;
      if (expoPushToken) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('EXPO TOKEN:', expoPushToken);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      }
    } catch (e) {
      console.log('[Push] getExpoPushTokenAsync failed:', e);
    }

    // ========================================
    // GET FCM DEVICE TOKEN (Android) / APNs DEVICE TOKEN (iOS)
    // ========================================
    try {
      const fcmTokenData = await Notifications.getDevicePushTokenAsync();
      fcmDeviceToken = fcmTokenData?.data || null;
      if (fcmDeviceToken) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('FCM TOKEN:', fcmDeviceToken);
        console.log('FOR BACKEND USE: Use this token in send.js script');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      }
    } catch (e) {
      console.log('[Push] getDevicePushTokenAsync failed:', e);
    }

    // If no token obtained, log error
    if (!expoPushToken && !fcmDeviceToken) {
      console.log('[Push] ERROR: No token obtained');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('TOKEN ERROR: No push token could be obtained');
      console.log('Check: 1) Internet connection 2) google-services.json');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return { expoToken: null, fcmToken: null };
    }

    // Send FCM token to backend (preferred for production)
    if (fcmDeviceToken) {
      try {
        // Store token locally for push notifications
        await Storage.setFcmToken(fcmDeviceToken);
        console.log('[Push] Token stored locally');
      } catch (e) {
        console.log('[Push] Token storage failed:', e);
      }
      
      // Get user ID for token registration
      let userId = '';
      try {
        const { supabase } = await import('./supabase');
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          userId = user.id;
        }
      } catch {}
      
      try {
        // Register with Supabase backend (Edge Function)
        await api.subscribePush(fcmDeviceToken, Platform.OS as 'android' | 'ios', userId);
        console.log('[Push] Token registered with Supabase backend');
      } catch (e) {
        console.log('[Push] Supabase backend subscribe failed:', e);
      }
      // Also register with backend server (MongoDB) for automatic notifications
      try {
        const backendUrl = 'https://api.indexpilotai.com';
        await fetch(`${backendUrl}/push/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: fcmDeviceToken,
            platform: Platform.OS,
            user_id: userId,
          }),
        });
        console.log('[Push] Token registered with backend server');
      } catch (e) {
        console.log('[Push] Backend server subscribe failed:', e);
      }
    }

    registered = true;
    return { expoToken: expoPushToken, fcmToken: fcmDeviceToken };
  } catch (err) {
    console.log('[Push] Setup FAILED:', err);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('PUSH SETUP FAILED:', err);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return { expoToken: null, fcmToken: null };
  }
}

/**
 * Listener for foreground notifications.
 * Logs notification received with terminal-friendly format.
 */
export function attachForegroundListener(onReceive: (n: any) => void): () => void {
  if (!canUsePush) return () => {};
  let subRef: any = null;
  import('expo-notifications').then((Notifications) => {
    subRef = Notifications.addNotificationReceivedListener((notification) => {
      // Terminal-friendly logging for foreground notifications
      const content = notification?.request?.content;
      const title = content?.title || '(none)';
      const body = content?.body || '(none)';
      const data = JSON.stringify(content?.data || {});
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📬 NOTIFICATION RECEIVED (FOREGROUND):');
      console.log('  Title:', title);
      console.log('  Body:', body);
      console.log('  Data:', data);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // Call the provided callback
      onReceive(notification);
    });
  }).catch(() => {});
  return () => { try { subRef?.remove(); } catch {} };
}

/**
 * Listener for notification taps (when user taps notification).
 */
export function attachResponseListener(onTap: (r: any) => void): () => void {
  if (!canUsePush) return () => {};
  let subRef: any = null;
  import('expo-notifications').then((Notifications) => {
    subRef = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('👆 NOTIFICATION TAPPED:');
      console.log('  Action Identifier:', response?.actionIdentifier);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      onTap(response);
    });
  }).catch(() => {});
  return () => { try { subRef?.remove(); } catch {} };
}

/**
 * Local notification (for testing / fallback).
 */
export async function showLocalNotification(title: string, body: string, channel = 'default') {
  if (!canUsePush) return;
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true, badge: 1 },
      trigger: Platform.OS === 'android' ? ({ channelId: channel } as any) : null,
    });
  } catch {}
}
