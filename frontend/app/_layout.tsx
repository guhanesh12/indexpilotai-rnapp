import React, { useEffect, useState, useRef, Component, ReactNode } from 'react';
import './web-polyfills';
import { useRouter, useSegments, Stack, Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, Platform, PermissionsAndroid, ViewStyle, Linking } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import * as SplashScreen from 'expo-splash-screen';
import Constants from 'expo-constants';
import { AuthProvider, useAuth } from '@/src/contexts/AuthContext';
import { AIChatProvider } from '@/src/contexts/AIChatContext';
import { BrokerProvider } from '@/src/broker/BrokerContext';
import {
  loadPendingDeepLink,
  savePendingDeepLink,
  clearPendingDeepLink,
  loadPendingReferralCode,
  savePendingReferralCode,
} from '@/src/broker/BrokerContext';
import { ThemeProvider, useTheme } from '@/src/contexts/ThemeContext';
import { initializeFCM, onForegroundMessage, onNotificationTap, setupNotificationOpenedHandlers } from '@/src/lib/push-fcm';
import { AppState, AppStateStatus } from 'react-native';
import { ForceUpdateModal } from '@/src/updates/ForceUpdateModal';
import { checkAppUpdate } from '@/src/updates/checkAppUpdate';

if (typeof globalThis !== 'undefined' && globalThis.addEventListener) {
  globalThis.addEventListener('unhandledrejection', (event: any) => {
    const reason = event?.reason;
    if (reason && (reason?.message?.includes?.('Invalid Refresh Token') || reason?.message?.includes?.('Refresh Token Not Found'))) {
      console.log('[GlobalHandler] Suppressed invalid refresh token error');
      event.preventDefault();
    }
  });
}

const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  const msg = args.join(' ');
  if (msg.includes('expo-notifications') && msg.includes('Expo Go')) {
    return;
  }
  originalConsoleError.apply(console, args);
};

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// --- COMPONENTS ---

// Error Boundary to catch rendering errors
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error?: Error }> {
  state: { hasError: boolean; error?: Error } = { hasError: false, error: undefined };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>{this.state.error?.message || 'Please restart the app'}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// Main navigation and authentication gate
function RootNavigation() {
  const { authReady, signedIn, pinState } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const lastPinStateRef = useRef<string | null>(null);
  const signedInRef = useRef(signedIn);
  const pinStateRef = useRef(pinState);
  const splashHandledRef = useRef(false);
  const isMountedRef = useRef(false);

  // Keep refs up to date
  signedInRef.current = signedIn;
  pinStateRef.current = pinState;

  // ─────────────────────────────────────────────
  // Deep linking: cold start + warm + replay after login
  // ─────────────────────────────────────────────
  const pendingDeepLinkHandledRef = useRef(false);
  useEffect(() => {
    isMountedRef.current = true;

    const extractReferral = (url: string): string | null => {
      try {
        const q = url.split("?")[1];
        if (!q) return null;
        const params = new URLSearchParams(q);
        const ref = params.get("ref");
        return ref ? ref.toUpperCase() : null;
      } catch {
        return null;
      }
    };

    const handleUrl = async (url: string | null) => {
      if (!url) return;
      const ref = extractReferral(url);
      if (ref) {
        await savePendingReferralCode(ref);
      }
      // If the user is signed in and unlocked, navigate immediately.
      // Otherwise, persist the URL — replay will happen once auth resolves.
      if (signedInRef.current && pinStateRef.current === "unlocked") {
        try {
          router.replace(url as any);
        } catch {
          /* ignore */
        }
        await clearPendingDeepLink();
      } else {
        await savePendingDeepLink(url);
      }
    };

    // Cold start
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    // Warm
    const sub = Linking.addEventListener("url", (e) => {
      handleUrl(e.url);
    });

    return () => {
      isMountedRef.current = false;
      sub.remove();
    };
  }, [router]);

  // Replay any pending deep link once user is signed in + unlocked.
  useEffect(() => {
    if (!authReady) return;
    if (!(signedIn && pinState === "unlocked")) return;
    if (pendingDeepLinkHandledRef.current) return;
    (async () => {
      const pending = await loadPendingDeepLink();
      if (pending) {
        pendingDeepLinkHandledRef.current = true;
        await clearPendingDeepLink();
        try {
          router.replace(pending as any);
        } catch {
          /* ignore */
        }
      } else {
        pendingDeepLinkHandledRef.current = true;
      }
    })();
  }, [authReady, signedIn, pinState, router]);

  // Mark component as mounted after first render - prevents navigation before Slot is ready
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Splash screen lifecycle:
  // Phase 1 (0-1.5s): Native splash screen visible (static logo from app.json)
  // Phase 2 (1.5-3s): Hide native splash to reveal React animated splash screen (index.tsx)
  // Phase 3 (3s+): Navigate based on auth state
  useEffect(() => {
    // Phase 1: After 1.5s, hide native splash to reveal React animated splash
    const nativeSplashTimeout = setTimeout(() => {
      console.log('[Nav] Hiding native splash, revealing React animated splash');
      SplashScreen.hideAsync().catch(e => console.warn('[App] Splash hide warning:', e));
    }, 1500); // 1.5 seconds - show native splash briefly, then reveal animated splash

    // Phase 2+3: After 3s total, navigate based on auth state
    const navigateTimeout = setTimeout(() => {
      if (splashHandledRef.current) return;
      splashHandledRef.current = true;

      // Guard: only navigate if the component is mounted and Slot is ready
      if (!isMountedRef.current) {
        console.warn('[Nav] Component not mounted yet, deferring navigation');
        // Defer navigation to next frame to ensure Slot is mounted
        requestAnimationFrame(() => {
          if (!isMountedRef.current) return;
          doNavigate();
        });
        return;
      }

      doNavigate();
    }, 3000); // 3 seconds - allows splash screen to display fully

    function doNavigate() {
      console.log('[Nav] Splash complete, navigating');

      // Navigate based on auth state after splash completes
      if (!signedInRef.current) {
        console.log('[Nav] Not signed in, going to login');
        router.replace('/(auth)/login' as any);
        return;
      }

      console.log('[Nav] Signed in, pinState:', pinStateRef.current);
      switch (pinStateRef.current) {
        case 'no-pin':
          router.replace('/create-pin' as any);
          break;
        case 'locked':
          router.replace('/enter-pin' as any);
          break;
        case 'unlocked':
          router.replace('/(tabs)/home' as any);
          break;
        default:
          // loading, unknown, error - go to login
          router.replace('/(auth)/login' as any);
          break;
      }
    }

    return () => {
      clearTimeout(nativeSplashTimeout);
      clearTimeout(navigateTimeout);
    };
  }, [router]); // Only depends on router - runs once on mount

  // Handle navigation based on auth state changes (after splash timer completes)
  useEffect(() => {
    // Guard: only navigate if the component is mounted and Slot is ready
    if (!isMountedRef.current) {
      return;
    }

    const currentRoute = segments[0] as string | undefined;
    const secondRoute = segments[1] as string | undefined;
    const inAuthGroup = currentRoute === '(auth)';
    const inAppGroup = currentRoute === '(tabs)';
    const isPinRoute = currentRoute ? ['create-pin', 'enter-pin', 'forgot-pin', 'otp-pin-reset'].includes(currentRoute) : false;
    const isOnLoginPage = inAuthGroup && secondRoute === 'login';
    const isOnSplash = !currentRoute; // On index/splash screen

    // Don't navigate away from splash screen - let the 3s timer handle it
    if (isOnSplash) {
      return;
    }

    // Handle sign out: if not signed in, navigate to login
    if (!signedIn) {
      if (!inAuthGroup) {
        console.log('[Nav] Not signed in, navigating to login');
        router.replace('/(auth)/login' as any);
      }
      return;
    }

    // Skip if PIN state hasn't changed (prevents loops)
    if (lastPinStateRef.current === pinState) {
      return;
    }

    console.log('[Nav] PIN state changed:', lastPinStateRef.current, '->', pinState, '| onLogin:', isOnLoginPage, '| inApp:', inAppGroup, '| isPinRoute:', isPinRoute, '| onSplash:', isOnSplash);

    // Update ref immediately
    lastPinStateRef.current = pinState;

    // Only navigate if signed in
    if (!signedIn) return;

    switch (pinState) {
      case 'no-pin':
        if (!isPinRoute || currentRoute !== 'create-pin') {
          console.log('[Nav] ✅ Navigating to create-pin');
          router.replace('/create-pin' as any);
        }
        break;
      case 'locked':
        if (!isPinRoute || currentRoute !== 'enter-pin') {
          console.log('[Nav] ✅ Navigating to enter-pin');
          router.replace('/enter-pin' as any);
        }
        break;
      case 'unlocked':
        if (!inAppGroup) {
          console.log('[Nav] ✅ Navigating to home');
          router.replace('/(tabs)/home' as any);
        }
        break;
      default:
        // unknown, loading, error - don't navigate
        break;
    }

  }, [signedIn, pinState, segments, router]);

  // Render Slot for expo-router navigation
  return (
    <>
      <UpdateGate />
      <Slot />
    </>
  );
}

// Update check component
const UpdateGate = () => {
  const [info, setInfo] = useState<any>(null);
  const [visible, setVisible] = useState(false);

  const compute = async () => {
    const installedVersion = Constants.expoConfig?.version;
    if (!installedVersion) return;
    const res = await checkAppUpdate(installedVersion);
    setInfo(res);
    setVisible(res.updateAvailable);
  };

  useEffect(() => {
    let isMounted = true;
    compute();
    const sub = AppState.addEventListener('change', (nextState) => {
      if (isMounted && nextState === 'active') compute();
    });
    const intervalId = setInterval(() => { if (isMounted) compute() }, 5 * 60 * 1000);
    return () => {
      isMounted = false;
      sub.remove();
      clearInterval(intervalId);
    };
  }, []);

  return (
    <ForceUpdateModal
      visible={visible && !!info?.updateAvailable}
      info={info}
      onRequestClose={() => {
        if (info?.forceUpdate === false) setVisible(false);
      }}
    />
  );
};


// --- ROOT LAYOUT ---

export default function RootLayout() {
  const router = useRouter();

  // Push notification setup
  useEffect(() => {
    (async () => {
      if (Platform.OS === 'android') {
        try {
          if ((Platform.Version as number) >= 33) {
            await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS' as any);
          }
        } catch (e) { console.log('[App] Notification permission request error:', e); }
      }
      
      // Always register push token with backend via expo-notifications
      // This ensures the token is sent even when FCM init succeeds but doesn't register
      try {
        const { registerForPushNotifications, attachForegroundListener, attachResponseListener } = await import('@/src/lib/push');
        const { expoToken, fcmToken } = await registerForPushNotifications();
        if (expoToken || fcmToken) {
          console.log('[App] Push token registered:', { expoToken: !!expoToken, fcmToken: !!fcmToken });
        }
        attachForegroundListener((n: any) => {
          const content = n?.request?.content;
          console.log('[App] Foreground notification:', content?.title, content?.body);
        });
        attachResponseListener((r: any) => {
          console.log('[App] Notification tapped:', r);
        });
      } catch (e) {
        console.log('[App] Push registration error:', e);
      }
      
      // Initialize FCM (native Firebase Cloud Messaging) for EAS builds
      try {
        await initializeFCM();
      } catch (e) {
        console.log('[App] FCM init error:', e);
      }
      
      try {
        onForegroundMessage((title, body, data) => console.log('[App] FCM notification:', title, body));
        await onNotificationTap((path) => router.replace(path as any));
        await setupNotificationOpenedHandlers((path) => router.replace(path as any));
      } catch (e) {
        console.log('[App] FCM handler setup failed:', e);
      }
    })();
  }, [router]);
  
  // Android navigation bar styling
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync('#000').catch(()=>{});
      NavigationBar.setButtonStyleAsync('light').catch(()=>{});
    }
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
         <ErrorBoundary>
           <ThemeProvider>
             <AuthProvider>
               <BrokerProvider>
                 <AIChatProvider>
                  <ThemedStatusBar />
                  <RootNavigation />
                 </AIChatProvider>
               </BrokerProvider>
             </AuthProvider>
           </ThemeProvider>
         </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const ThemedStatusBar = () => {
  const { themeMode, isLight } = useTheme();
  return <StatusBar style={isLight ? 'dark' : 'light'} />;
};

const styles = StyleSheet.create({ 
  root: { flex: 1, backgroundColor: '#050505' },
  errorContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorTitle: { color: '#FF4DD2', fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  errorText: { color: '#FFF', fontSize: 14, textAlign: 'center' },
});