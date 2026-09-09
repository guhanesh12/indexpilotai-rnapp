import { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
  Modal,
  Dimensions,
  Share,
} from 'react-native';
import Clipboard from 'expo-clipboard';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Card, Heading, Body } from '../../src/components/Primitives';
import { colors, spacing, typography, radius } from '../../src/lib/theme';
import { api } from '../../src/lib/api';
import { useAuth } from '../../src/contexts/AuthContext';
import { getReferralCode, getProfile } from '../../src/lib/supabase';
import AddFundsModal from '../../src/components/AddFundsModal';
import WalletHistoryModal from '../../src/components/WalletHistoryModal';
import { onRefetch } from '../../src/lib/refetchEvents';
import LiveSignalsCard from '../../src/components/LiveSignalsCard';
import AdvancedChart from '../../src/components/AdvancedChart';
import PnlScreenshotCard from '../../src/components/PnlScreenshotCard';
import { Storage } from '../../src/lib/storage';
import AIChatFab from '../../src/components/AIChatFab';
import AIChatSheet from '../../src/components/AIChatSheet';
import { useAIChat } from '../../src/contexts/AIChatContext';
import TrailingStopLossCard, { TrailingPosition } from '../../src/components/TrailingStopLossCard';
import { positionMonitorApi } from '../../src/lib/api';
import { useBroker } from '../../src/broker/BrokerContext';
import { BrokerLogo } from '../../src/broker/brokerLogos';

const APP_FEATURES = `🔹 AI-Powered Trading Engine
🔹 Real-time Position Monitoring  
🔹 Automated Buy/Sell Signals
🔹 Portfolio Tracking
🔹 Risk Management Tools`;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const WEBSITE_URL = 'https://www.indexpilotai.com';

const INDICES = ['NIFTY', 'BANKNIFTY', 'SENSEX'];

function getInitials(name: string, email: string): string {
  if (name && name.trim()) {
    return name.trim().charAt(0).toUpperCase();
  }
  const username = email?.split('@')[0] || 'U';
  return username.charAt(0).toUpperCase();
}

export function formatDuration(ms: number) {
  if (ms <= 0) return 'N/A';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

function marketOpen() {
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) return false;
  const ist = (now.getUTCHours() + 5) * 60 + (now.getUTCMinutes() + 30);
  return ist >= 9 * 60 + 15 && ist <= 15 * 60 + 30;
}

function timeToNextCandle(intervalMin: number) {
  const now = new Date();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const next = Math.ceil((minutes + 1) / intervalMin) * intervalMin;
  const diff = (next - minutes) * 60 - seconds;
  const mm = Math.floor(diff / 60).toString().padStart(2, '0');
  const ss = (diff % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

import { useProfile } from '../../src/hooks/useProfileData';

export default function HomeTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut, authReady } = useAuth();
  const { activeBrokerName, activeBroker, connected } = useBroker();
  const { profile, loading: profileLoading, error: profileError } = useProfile();
  const [refreshing, setRefreshing] = useState(false);
  const [wallet, setWallet] = useState<number>(0);
  const [todayPnl, setTodayPnl] = useState<number>(0);
  const [totalPnl, setTotalPnl] = useState<number>(0);
  const [positions, setPositions] = useState<any[]>([]);
  const [engineState, setEngineState] = useState<any>(null);
  const [marketQuotes, setMarketQuotes] = useState<Record<string, any>>({});
  const [fundLimits, setFundLimits] = useState<any>(null);
  const [countdown, setCountdown] = useState(timeToNextCandle(15));
  const [addFundsOpen, setAddFundsOpen] = useState(false);
  const aiChat = useAIChat();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showTfPicker, setShowTfPicker] = useState(false);
  const [screenshotOpen, setScreenshotOpen] = useState(false);
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [engineIntent, setEngineIntent] = useState<{ running: boolean; interval: string; ts: number } | null>(null);
  const [latestSignals, setLatestSignals] = useState<any>(null);
  const [monitorPositions, setMonitorPositions] = useState<any[]>([]);
  const [monitorAvailable, setMonitorAvailable] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);
  const [prevTotalNotifications, setPrevTotalNotifications] = useState<number>(0);
  const [notificationBanner, setNotificationBanner] = useState<{ title: string; body: string } | null>(null);
  const [trailingPositions, setTrailingPositions] = useState<TrailingPosition[]>([]);
  const captureRef = useRef<any>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isOpen = marketOpen();

  useEffect(() => {
    Storage.getEngineIntent().then((v) => v && setEngineIntent(v));
  }, []);

  const explicitRunning = engineState?.isRunning;
  const intentFresh = engineIntent && (Date.now() - engineIntent.ts < 30 * 1000);
  const engineRunning = intentFresh
    ? engineIntent!.running
    : (explicitRunning === true);
  const engineInterval = engineState?.candleInterval || engineIntent?.interval || '15';

  useEffect(() => {
    const t = setInterval(
      () => setCountdown(timeToNextCandle(parseInt(engineInterval, 10) || 15)),
      1000
    );
    return () => clearInterval(t);
  }, [engineInterval]);

  const loadAll = useCallback(async () => {
    const promises: Promise<any>[] = [
      api.getWalletBalance(),
      api.getLivePositions(),
      api.getWalletDailyStats(),
      api.getEngineDbStatus(),
      api.getFundLimits(),
    ];
    if (monitorAvailable) {
      promises.push(api.getMonitorActive());
    }
    const results = await Promise.allSettled(promises);
    const [w, p, s, e, f, m] = results;
    if (w.status === 'fulfilled') {
      const v: any = w.value;
      const b = v?.balance ?? v?.data?.balance ?? v?.wallet?.balance ?? 0;
      setWallet(Number(b) || 0);
    }
    if (p.status === 'fulfilled') {
      const v: any = p.value;
      const list = v?.positions ?? v?.data ?? v?.livePositions ?? [];
      const arr = Array.isArray(list) ? list : [];
      setPositions(arr);
      const t = arr.reduce((sum: number, x: any) => sum + (Number(x.pnl || x.profitLoss || 0) || 0), 0);
      setTodayPnl(t);
    }
    if (s.status === 'fulfilled') {
      const v: any = s.value;
      const dailyTotal = Number(v?.totalProfit ?? v?.data?.totalProfit ?? v?.totalPnL ?? v?.totalRealizedPnL ?? 0);
      setTotalPnl(dailyTotal || todayPnl);
    } else {
      setTotalPnl(todayPnl);
    }
    if (e.status === 'fulfilled') {
      const v: any = e.value;
      const eng = v?.engine || v?.data?.engine || v;
      setEngineState({
        isRunning: eng?.isRunning,
        candleInterval: eng?.strategySettings?.candleInterval || eng?.candleInterval,
        symbolsCount: Array.isArray(eng?.selectedSymbols) ? eng.selectedSymbols.length : (eng?.symbolsCount || 0),
        lastHeartbeat: eng?.lastHeartbeat ? new Date(eng.lastHeartbeat).getTime() : Date.now(),
        startTime: eng?.startedAt ? new Date(eng.startedAt).getTime() : 0,
        selectedSymbols: eng?.selectedSymbols || [],
      });
      const sig = v?.latestSignals || v?.data?.latestSignals;
      if (sig) setLatestSignals(sig);
    }
    if (f.status === 'fulfilled') {
      const v: any = f.value;
      if (v?.success !== false && (v?.funds || v?.availableBalance !== undefined)) {
        const funds = v?.funds || v?.data || v;
        setFundLimits(funds);
      } else {
        const localCreds = await Storage.getBrokerCreds();
        if (localCreds?.clientId && localCreds?.accessToken) {
          try {
            const direct: any = await api.testDhanDirect(localCreds.clientId, localCreds.accessToken);
            if (direct?.connected && direct?.funds) {
              setFundLimits(direct.funds);
              return;
            }
          } catch {}
        }
        setFundLimits(null);
      }
    }
    if (m && m.status === 'fulfilled') {
      const v: any = m.value;
      const list = v?.positions ?? v?.data ?? v?.activePositions ?? v?.monitor ?? [];
      setMonitorPositions(Array.isArray(list) ? list : []);
    } else if (m && m.status === 'rejected') {
      const msg = String((m as any).reason?.message || '').toLowerCase();
      if (msg.includes('404') || msg.includes('not found') || msg.includes('failed (404)')) {
        setMonitorAvailable(false);
      }
    }
  }, [monitorAvailable]);

  const loadCritical = useCallback(async () => {
    const promises: Promise<any>[] = [
      api.getWalletBalance(),
      api.getLivePositions(),
      api.getFundLimits(),
    ];
    const results = await Promise.allSettled(promises);
    const [w, p, f] = results;
    if (w.status === 'fulfilled') {
      const v: any = w.value;
      const b = v?.balance ?? v?.data?.balance ?? v?.wallet?.balance ?? 0;
      setWallet(Number(b) || 0);
    }
    if (p.status === 'fulfilled') {
      const v: any = p.value;
      const list = v?.positions ?? v?.data ?? v?.livePositions ?? [];
      const arr = Array.isArray(list) ? list : [];
      setPositions(arr);
      const t = arr.reduce((sum: number, x: any) => sum + (Number(x.pnl || x.profitLoss || 0) || 0), 0);
      setTodayPnl(t);
    }
    if (f.status === 'fulfilled') {
      const v: any = f.value;
      if (v?.success !== false && (v?.funds || v?.availableBalance !== undefined)) {
        const funds = v?.funds || v?.data || v;
        setFundLimits(funds);
      } else {
        const localCreds = await Storage.getBrokerCreds();
        if (localCreds?.clientId && localCreds?.accessToken) {
          try {
            const direct: any = await api.testDhanDirect(localCreds.clientId, localCreds.accessToken);
            if (direct?.connected && direct?.funds) {
              setFundLimits(direct.funds);
              return;
            }
          } catch {}
        }
        setFundLimits(null);
      }
    }
  }, []);

  const loadSecondary = useCallback(async () => {
    const promises: Promise<any>[] = [
      api.getWalletDailyStats(),
      api.getEngineDbStatus(),
    ];
    if (monitorAvailable) {
      promises.push(api.getMonitorActive());
    }
    const results = await Promise.allSettled(promises);
    const [s, e, m] = results;
    if (s.status === 'fulfilled') {
      const v: any = s.value;
      const dailyTotal = Number(v?.totalProfit ?? v?.data?.totalProfit ?? v?.totalPnL ?? v?.totalRealizedPnL ?? 0);
      setTotalPnl(dailyTotal || todayPnl);
    } else {
      setTotalPnl(todayPnl);
    }
    if (e.status === 'fulfilled') {
      const v: any = e.value;
      const eng = v?.engine || v?.data?.engine || v;
      setEngineState({
        isRunning: eng?.isRunning,
        candleInterval: eng?.strategySettings?.candleInterval || eng?.candleInterval,
        symbolsCount: Array.isArray(eng?.selectedSymbols) ? eng.selectedSymbols.length : (eng?.symbolsCount || 0),
        lastHeartbeat: eng?.lastHeartbeat ? new Date(eng.lastHeartbeat).getTime() : Date.now(),
        startTime: eng?.startedAt ? new Date(eng.startedAt).getTime() : 0,
        selectedSymbols: eng?.selectedSymbols || [],
      });
      const sig = v?.latestSignals || v?.data?.latestSignals;
      if (sig) setLatestSignals(sig);
    }
    if (m && m.status === 'fulfilled') {
      const v: any = m.value;
      const list = v?.positions ?? v?.data ?? v?.activePositions ?? v?.monitor ?? [];
      setMonitorPositions(Array.isArray(list) ? list : []);
    } else if (m && m.status === 'rejected') {
      const msg = String((m as any).reason?.message || '').toLowerCase();
      if (msg.includes('404') || msg.includes('not found') || msg.includes('failed (404)')) {
        setMonitorAvailable(false);
      }
    }
  }, [monitorAvailable, todayPnl]);

  const loadQuotes = useCallback(async () => {}, []);

  // ── Trailing Stop-Loss polling (every 2-3s while screen focused) ──
  const loadTrailingPositions = useCallback(async () => {
    try {
      const res: any = await positionMonitorApi.getList();
      const list = res?.positions ?? res?.data ?? [];
      const arr = Array.isArray(list) ? list : [];
      // Only show positions where trailing is enabled
      const trailing = arr.filter((p: any) => p?.raw_position?.trailingEnabled === true);
      setTrailingPositions(trailing);
    } catch {
      // Silently fail — trailing card just won't show
    }
  }, []);

  useEffect(() => {
    if (!authReady || !user) return;

    loadCritical();
    loadSecondary();
    loadQuotes();
    loadTrailingPositions();

    const criticalTimer = setInterval(loadCritical, 2000);
    const secondaryTimer = setInterval(loadSecondary, 5000);
    const quoteTimer = setInterval(loadQuotes, 5000);
    const trailingTimer = setInterval(loadTrailingPositions, 2500);

    const unsub = onRefetch('wallet:refresh', () => {
      loadCritical().catch(() => {});
    });

    const unsubTrailing = onRefetch('trailing:refresh', () => {
      loadTrailingPositions().catch(() => {});
    });

    let unsubFcm: (() => void) | null = null;
    try {
      const { onForegroundMessage } = require('../../src/lib/push-fcm');
      if (typeof onForegroundMessage === 'function') {
        unsubFcm = onForegroundMessage((title: string, body: string, data?: Record<string, string>) => {
          const type = data?.type || '';
          if (type === 'TRAILING_ACTIVATED' || type === 'TRAILING_STEP') {
            loadTrailingPositions().catch(() => {});
            setNotificationBanner({ title: title || 'Trailing Update', body: body || '' });
            setTimeout(() => setNotificationBanner(null), 5000);
          }
        });
      }
    } catch {}

    return () => {
      clearInterval(criticalTimer);
      clearInterval(secondaryTimer);
      clearInterval(quoteTimer);
      clearInterval(trailingTimer);
      unsub?.();
      unsubTrailing?.();
      unsubFcm?.();
    };
  }, [authReady, user, loadCritical, loadSecondary, loadQuotes, loadTrailingPositions]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const data: any = await api.getNotifications();
      const list = data?.notifications ?? data?.data ?? data ?? [];
      const arr = Array.isArray(list) ? list : [];
      const unread = arr.filter((n: any) => !n.read).length;
      setUnreadNotifications(unread);
      
      // Detect new notifications for banner
      if (prevTotalNotifications > 0 && arr.length > prevTotalNotifications) {
        const newCount = arr.length - prevTotalNotifications;
        const newest = arr.slice(0, newCount);
        if (newest.length > 0) {
          setNotificationBanner({
            title: newest[0].title || 'New Notification',
            body: `${newCount} new notification${newCount > 1 ? 's' : ''}`,
          });
          // Auto-hide banner after 5 seconds
          setTimeout(() => setNotificationBanner(null), 5000);
        }
      }
      setPrevTotalNotifications(arr.length);
    } catch {
      // Silently fail - not critical
    }
  }, [prevTotalNotifications]);

  useEffect(() => {
    if (!authReady || !user) return;
    fetchUnreadCount();
    const unreadTimer = setInterval(fetchUnreadCount, 10000);
    return () => clearInterval(unreadTimer);
  }, [authReady, user, fetchUnreadCount]);

  const onRefresh = async () => {
    if (!authReady || !user) return;
    setRefreshing(true);
    await Promise.all([loadCritical(), loadSecondary(), loadQuotes()]);
    setRefreshing(false);
  };

  const openWebsite = (path: string = '') => {
    Linking.openURL(`${WEBSITE_URL}${path}`).catch(() => {
      Alert.alert('Open in browser', 'Could not open link');
    });
  };

  useEffect(() => {
    if (user?.id) {
      // Try API endpoint first (returns referral code from backend)
      api.getProfileMe().then(data => {
        if (data?.referralCode) {
          setReferralCode(data.referralCode);
        }
      }).catch(() => {
        // Fallback to Supabase direct query
        getReferralCode(user.id).then(codeData => {
          if (codeData?.code) setReferralCode(codeData.code);
        }).catch((err) => {
          console.warn('[HomeTab] Failed to fetch referral code:', err?.message || err);
          setReferralCode(null);
        });
      });
    }
  }, [user?.id]);

  const displayName =
    (profile?.full_name && String(profile.full_name).trim().length > 0)
      ? profile.full_name
      : (user?.name && String(user.name).trim().length > 0)
        ? user.name
        : (user?.email ? String(user.email).split('@')[0] : 'Trader');
  const userInitials = getInitials(displayName, user?.email || '');
  let userId = "GUEST";
  if (profile?.client_id) {
    userId = profile.client_id;
  } else if (user?.id) {
    userId = String(user.id).substring(0, 8).toUpperCase();
  }
  const referralLink = referralCode ? `https://www.indexpilotai.com/register?ref=${referralCode}` : `https://www.indexpilotai.com/register`;
  const engineStartTime = engineState?.startTime || 0;
  const engineRunningDuration = engineRunning && engineStartTime ? Date.now() - engineStartTime : 0;
  const runningTime = formatDuration(engineRunningDuration);
  const positionSymbols = positions.map((p: any) => p.symbol || p.tradingSymbol).join(', ');

  const stopEngine = async () => {
    try {
      const intentObj = { running: false, interval: engineInterval, ts: Date.now() };
      await Storage.setEngineIntent(false);
      setEngineIntent(intentObj);

      const stopRes: any = await api.stopEngine().catch((e: any) => ({ error: e?.message }));
      await api.setEngineState({
        isRunning: false,
        enabled: false,
        status: 'stopped',
      }).catch(() => {});

      await new Promise((r) => setTimeout(r, 1500));
      let verify: any = null;
      try {
        verify = await api.getEngineDbStatus();
      } catch {}
      const stillRunning = (verify?.engine?.isRunning ?? verify?.data?.engine?.isRunning) === true;
      if (stillRunning) {
        await api.setEngineState({ isRunning: false, enabled: false, status: 'stopped' }).catch(() => {});
        await api.stopEngine().catch(() => {});
      }
      await loadAll();

      Alert.alert(
        '🛑 Engine Stopped',
        stillRunning
          ? 'Stop signal sent twice — website will reflect within 10s.'
          : 'Auto-trading paused.\nSynced with website ✓'
      );
    } catch (e: any) {
      Alert.alert('Failed to stop', e.message || 'Could not stop engine');
      await loadAll();
    }
  };

  const startEngine = async (interval: '5' | '15' = '15') => {
    setShowTfPicker(false);
    
    const MIN_WALLET = 89;
    if (wallet < MIN_WALLET) {
      Alert.alert(
        '💰 Insufficient Wallet Balance',
        `Engine requires a minimum of ₹${MIN_WALLET} in your wallet to start.\n\nCurrent balance: ₹${wallet.toLocaleString('en-IN', { maximumFractionDigits: 2 })}\n\nTap "Add Funds" to recharge.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Funds', onPress: () => setAddFundsOpen(true) },
        ]
      );
      return;
    }
    
    // Start in background immediately - show running UI
    const intentObj = { running: true, interval, ts: Date.now() };
    await Storage.setEngineIntent(true, interval);
    setEngineIntent(intentObj);
    
    try {
      const r: any = await api.getSymbols();
      const allSyms = r?.symbols || r?.data || [];
      const activeManual = allSyms.filter((s: any) => s.active !== false);

      let symbolsToStart: any[] = activeManual;

      if (!activeManual.length) {
        try {
          const autoRes: any = await api.getAutoSymbolConfig();
          const slots = autoRes?.slots;
          const enabledSlots = Array.isArray(slots) ? slots.filter((s: any) => s?.enabled) : [];
          if (enabledSlots.length) {
            symbolsToStart = enabledSlots;
          } else {
            setEngineIntent(null);
            await Storage.setEngineIntent(false);
            Alert.alert(
              'No symbols',
              'Add at least one trading symbol from the Symbols tab before starting the engine (or enable Auto Symbols).'
            );
            return;
          }
        } catch (e: any) {
          setEngineIntent(null);
          await Storage.setEngineIntent(false);
          Alert.alert(
            'No symbols',
            'Add at least one trading symbol from the Symbols tab before starting the engine.'
          );
          return;
        }
      }

      const res: any = await api.startEngine(interval, symbolsToStart);
      if (res?.success === false) {
        setEngineIntent(null);
        await Storage.setEngineIntent(false);
        Alert.alert('Engine error', res?.error || res?.message || 'Failed to start engine');
        return;
      }
      await loadAll();
    } catch (e: any) {
      setEngineIntent(null);
      await Storage.setEngineIntent(false);
      Alert.alert('Engine error', e.message + '\n\nTip: Make sure broker is connected first.');
    }
  };

  // Confirmation popup for starting the engine - shows immediately on click
  const handleStartEnginePress = () => {
    Alert.alert(
      '🚀 Start AI Trading Engine',
      'The engine will begin auto-trading based on AI signals. Make sure your broker is connected.\n\nContinue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start Engine', style: 'default', onPress: () => setShowTfPicker(true) },
      ],
      { cancelable: true }
    );
  };

  // Confirmation popup for stopping the engine - shows immediately on click
  const handleStopEnginePress = () => {
    Alert.alert(
      '🛑 Stop AI Trading Engine',
      'The engine will stop auto-trading. Any open positions will remain active.\n\nContinue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Stop Engine', style: 'destructive', onPress: stopEngine },
      ],
      { cancelable: true }
    );
  };

  const pulse = useSharedValue(0.4);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  if (!authReady) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg.primary }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#7C5CFF" />
          <Text style={{ color: colors.text.secondary, marginTop: 12, fontWeight: '700' }}>
            Loading your session…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        contentContainerStyle={{
          padding: spacing.base,
          // Space so the floating tab bar never overlaps "Active Positions" while scrolling.
          paddingBottom: 32 + insets.bottom + 65 + 16,
        }}
      >
{/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.welcome}>WELCOME BACK TRADER</Text>
            <Heading variant="h3" numberOfLines={1}>{displayName}</Heading>
          </View>
<View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {/* Notification bell icon with unread badge */}
            <TouchableOpacity
              onPress={() => router.push('/notifications')}
              style={styles.iconBtn}
            >
              <View>
                <Ionicons name="notifications-outline" size={20} color={colors.text.primary} />
                {unreadNotifications > 0 && (
                  <View style={styles.badgeContainer}>
                    <Text style={styles.badgeText}>
                      {unreadNotifications > 99 ? '99+' : unreadNotifications}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
            {/* Profile button - navigates to profile details */}
            <TouchableOpacity
              testID="profile-button"
              onPress={() => router.push('/(tabs)/profile')}
              style={styles.iconBtn}
            >
              <Ionicons name="person" size={20} color={colors.text.primary} />
            </TouchableOpacity>
            {/* Logout button */}
            <TouchableOpacity
              testID="logout-button"
              onPress={() =>
                Alert.alert('Sign out', 'Are you sure?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Sign out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)/login'); } },
                ])
              }
              style={styles.iconBtn}
            >
              <Ionicons name="log-out-outline" size={20} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* New Notification Banner */}
        {notificationBanner && (
          <View style={styles.notificationBanner}>
            <View style={styles.notificationBannerContent}>
              <View style={styles.notificationBannerDot} />
              <View style={styles.notificationBannerTextContainer}>
                <Text style={styles.notificationBannerTitle}>{notificationBanner.title}</Text>
                <Text style={styles.notificationBannerBody}>{notificationBanner.body}</Text>
              </View>
              <TouchableOpacity onPress={() => setNotificationBanner(null)} style={styles.notificationBannerDismiss}>
                <Ionicons name="close" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Mini broker status card */}
        {activeBrokerName && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/(tabs)/broker')}
            style={styles.miniBrokerCard}
          >
            <View style={styles.miniBrokerLeft}>
              <BrokerLogo id={activeBroker || undefined} name={activeBrokerName} color="#7C5CFF" size={32} />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={styles.miniBrokerName}>{activeBrokerName}</Text>
                <View style={styles.miniBrokerStatusRow}>
                  <View style={[styles.miniBrokerDot, { backgroundColor: connected ? '#00FF66' : '#FF3344' }]} />
                  <Text style={[styles.miniBrokerStatus, { color: connected ? '#00FF66' : '#FF3344' }]}>
                    {connected ? 'Live' : 'Not Connected'}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.miniBrokerRight}>
              <View style={styles.miniBrokerStat}>
                <Text style={styles.miniBrokerStatLabel}>BALANCE</Text>
                <Text style={styles.miniBrokerStatValue}>
                  ₹{Number(fundLimits?.availableBalance || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </Text>
              </View>
              <View style={[styles.miniBrokerDivider, { borderLeftColor: 'rgba(255,255,255,0.08)' }]} />
              <View style={styles.miniBrokerStat}>
                <Text style={styles.miniBrokerStatLabel}>POSITIONS</Text>
                <Text style={styles.miniBrokerStatValue}>{positions.length}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Wallet hero */}
        <LinearGradient
          colors={['#00B4FF', '#7C5CFF', '#FF4DD2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.walletCard}
        >
          <View style={styles.walletInner}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.walletLabel}>WALLET BALANCE</Text>
              <View style={styles.marketInd}>
                <Animated.View style={[styles.marketDot, pulseStyle, { backgroundColor: isOpen ? '#00FF66' : '#FF3344' }]} testID="market-status-indicator" />
                <Text style={{ color: isOpen ? '#00FF66' : '#FF3344', fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>
                  {isOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
                </Text>
              </View>
            </View>
            <Text style={styles.walletAmount} testID="dashboard-wallet-balance">
              ₹{wallet.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.base }}>
              <TouchableOpacity
                testID="add-funds-button"
                onPress={() => setAddFundsOpen(true)}
                style={styles.walletBtn}
              >
                <Ionicons name="add-circle" size={16} color="#050505" />
                <Text style={{ color: '#050505', fontWeight: '800', fontSize: 13 }}>Add Funds</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setHistoryOpen(true)} style={styles.walletBtnGhost}>
                <Ionicons name="receipt-outline" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>History</Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        {/* PnL row - tap to go to Position Monitor */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.base }}>
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => router.push('/(tabs)/position-monitor')}
            activeOpacity={0.7}
          >
            <PnlCard label="TODAY'S P&L" value={todayPnl} testID="dashboard-today-pnl" gradient={['#00FF66', '#00B4A0']} />
          </TouchableOpacity>
        </View>

        {/* Trailing Stop-Loss Cards (under P&L, above engine) */}
        {trailingPositions.length > 0 && (
          <View style={{ marginTop: spacing.base }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
              <Text style={[styles.sectionTitle, { color: '#FFB800' }]}>
                ⚡ TRAILING STOP-LOSS ({trailingPositions.length})
              </Text>
              <Text style={{ color: colors.text.disabled, fontSize: 10 }}>live</Text>
            </View>
            {trailingPositions.map((tp: any, idx: number) => (
              <TrailingStopLossCard key={tp.order_id || tp.orderId || tp.id || idx} position={tp} />
            ))}
          </View>
        )}



        {/* Broker fund-limits card */}
        {fundLimits && (fundLimits.availableBalance || fundLimits.utilizedAmount) ? (
          <LinearGradient colors={['#0A0A1F', '#000']} style={styles.fundCard}>
            <Text style={styles.fundLabel}>⚡ BROKER FUNDS ({activeBrokerName.toUpperCase()})</Text>
            <View style={{ flexDirection: 'row', marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text.disabled, fontSize: 9, fontWeight: '700' }}>AVAILABLE</Text>
                <Text style={{ color: '#00FF66', fontSize: 16, fontWeight: '800', marginTop: 2 }}>
                  ₹{Number(fundLimits.availableBalance || 0).toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.06)', paddingLeft: 12 }}>
                <Text style={{ color: colors.text.disabled, fontSize: 9, fontWeight: '700' }}>UTILIZED</Text>
                <Text style={{ color: '#FFB800', fontSize: 16, fontWeight: '800', marginTop: 2 }}>
                  ₹{Number(fundLimits.utilizedAmount || 0).toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
          </LinearGradient>
        ) : null}

        {/* Engine card */}
        <LinearGradient
          colors={engineRunning ? ['#053D2C', '#001F12'] : ['#1A1A22', '#0F0F13']}
          style={[styles.engineCard, engineRunning && styles.engineCardRunning]}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.engineLabel}>⚡ AI TRADING ENGINE</Text>
              <Text
                style={{ color: engineRunning ? '#00FF66' : '#888', fontSize: 18, fontWeight: '800', marginTop: 4 }}
                testID="engine-status-text"
              >
                {engineRunning ? `● RUNNING · ${engineInterval}M` : '○ STOPPED'}
              </Text>
              <Text style={{ color: colors.text.secondary, fontSize: 11, marginTop: 4 }}>
                {engineRunning
                  ? 'Auto-trading every candle close'
                  : 'Tap ▶ to start auto-trading'}
              </Text>
            </View>
            <View />
          </View>

          {!engineRunning && wallet < 89 ? (
            <View style={styles.lowBalanceBanner}>
              <Ionicons name="warning" size={14} color="#FFB800" />
              <Text style={{ color: '#FFB800', fontSize: 11, fontWeight: '700', flex: 1 }}>
                Minimum ₹89 wallet balance required to start engine
              </Text>
              <TouchableOpacity onPress={() => setAddFundsOpen(true)} style={styles.miniAddBtn}>
                <Text style={{ color: '#000', fontSize: 10, fontWeight: '900' }}>+ FUND</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.engineMeta}>
          </View>
        </LinearGradient>

        {/* Engine Start/Stop Button Below Card */}
        <TouchableOpacity
          onPress={engineRunning ? handleStopEnginePress : handleStartEnginePress}
          style={[styles.engineActionBtn, engineRunning ? styles.engineActionStop : styles.engineActionStart]}
          testID={engineRunning ? "engine-stop-button" : "engine-start-button"}
          disabled={(!engineRunning && wallet < 89)}
        >
          <Ionicons name={engineRunning ? "stop-circle" : "play-circle"} size={28} color={engineRunning ? "#FF3344" : "#050505"} />
          <Text style={[styles.engineActionText, { color: engineRunning ? "#FF3344" : "#050505" }]}>
            {engineRunning ? 'STOP ENGINE' : 'START ENGINE'}
          </Text>
        </TouchableOpacity>

        {!engineRunning && wallet < 89 ? (
          <TouchableOpacity onPress={() => setAddFundsOpen(true)} style={styles.engineLowFundBtn}>
            <Ionicons name="wallet-outline" size={16} color="#FFB800" />
            <Text style={{ color: '#FFB800', fontSize: 12, fontWeight: '700' }}>
              Need ₹89 minimum — Add Funds
            </Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.engineMeta}>
            <View style={styles.engineMetaItem}>
              <Text style={styles.metaLabel}>NEXT CANDLE</Text>
              <Text style={styles.metaValue} testID="next-candle-countdown">{countdown}</Text>
            </View>
            <View style={[styles.engineMetaItem, { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.06)' }]}>
              <Text style={styles.metaLabel}>POSITIONS</Text>
              <Text style={styles.metaValue}>{positions.length}</Text>
            </View>
            <View style={[styles.engineMetaItem, { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.06)' }]}>
              <Text style={styles.metaLabel}>STATUS</Text>
              <Text style={[styles.metaValue, { color: isOpen ? '#00FF66' : '#FF3344', fontSize: 13 }]}>
                {isOpen ? 'OPEN' : 'CLOSED'}
              </Text>
            </View>
          </View>

        {/* Backtest Button */}
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/backtest')}
          style={styles.backtestBtn}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#7C5CFF', '#5238B6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.backtestBtnGradient}
          >
            <Ionicons name="flask" size={24} color="#fff" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.backtestBtnTitle}>Strategy Backtest</Text>
              <Text style={styles.backtestBtnSub}>Replay AI signals on real market data</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Advanced TradingView-like Intraday Chart */}
        <AdvancedChart />

        {/* Live AI Signals (every candle close) */}
        <LiveSignalsCard signals={latestSignals} interval={engineInterval} />

        {/* Positions */}
        <View style={{ marginTop: spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
            <Text style={styles.sectionTitle}>ACTIVE POSITIONS</Text>
            <Text style={{ color: colors.text.disabled, fontSize: 10 }}>↻ auto 1s</Text>
          </View>
          <View testID="active-positions-list">
            {positions.length === 0 ? (
              <Card>
                <Body style={{ textAlign: 'center' }}>No active positions</Body>
              </Card>
            ) : (
              positions.map((p: any, idx: number) => <PositionRow key={p.positionId || p.id || idx} p={p} />)
            )}
          </View>
        </View>

        {/* Position Monitor (real-time AI exit signals — per IndexPilotAI_PositionMonitor_API.md) */}
        {monitorPositions.length > 0 && (
          <View style={{ marginTop: spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Animated.View style={[styles.marketDot, pulseStyle, { backgroundColor: '#7C5CFF' }]} />
                <Text style={[styles.sectionTitle, { color: '#B49AFF' }]}>
                  AI POSITION MONITOR ({monitorPositions.length})
                </Text>
              </View>
              <Text style={{ color: colors.text.disabled, fontSize: 10 }}>live</Text>
            </View>
            <View testID="monitor-positions-list">
              {monitorPositions.map((mp: any, idx: number) => (
                <MonitorRow key={mp.positionId || mp.id || mp.symbol || idx} m={mp} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Modals */}
      <AddFundsModal
        visible={addFundsOpen}
        onClose={() => setAddFundsOpen(false)}
        onSuccess={loadAll}
        user={{
          name: user?.name,
          email: user?.email,
          phone: (user as any)?.phone,
        }}
      />
      <WalletHistoryModal
        visible={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />

      {/* Timeframe picker for engine start */}
      <Modal visible={showTfPicker} animationType="fade" transparent onRequestClose={() => setShowTfPicker(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setShowTfPicker(false)} style={styles.tfBackdrop}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.tfSheet}>
            <View style={{ alignItems: 'center', paddingBottom: 16 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', marginBottom: 12 }} />
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>Select Timeframe</Text>
              <Text style={{ color: colors.text.secondary, fontSize: 12, marginTop: 4 }}>Engine will scan every candle close</Text>
            </View>
            {[
              { v: '5' as const, label: '5 Minutes', desc: 'High frequency · 75 trades/day max', color: '#FF4DD2' },
              { v: '15' as const, label: '15 Minutes', desc: 'Balanced · 25 trades/day max · ⚡ Recommended', color: '#7C5CFF' },
            ].map((tf) => (
              <TouchableOpacity
                key={tf.v}
                onPress={() => startEngine(tf.v)}
                style={[styles.tfOpt, { borderColor: tf.color + '88' }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{tf.label}</Text>
                  <Text style={{ color: colors.text.secondary, fontSize: 11, marginTop: 2 }}>{tf.desc}</Text>
                </View>
                <View style={[styles.tfBadge, { backgroundColor: tf.color }]}>
                  <Text style={{ color: '#000', fontWeight: '900', fontSize: 13 }}>{tf.v}M</Text>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setShowTfPicker(false)} style={styles.tfCancel}>
              <Text style={{ color: colors.text.secondary, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
          {/* AI Chat FAB */}
      <AIChatFab />
      {/* AI Chat Sheet */}
      <AIChatSheet visible={aiChat.sheetVisible} onClose={aiChat.closeSheet} />
</SafeAreaView>
  );
}

function PnlCard({
  label,
  value,
  testID,
  gradient,
}: {
  label: string;
  value: number;
  testID?: string;
  gradient: string[];
}) {
  const positive = value >= 0;
  return (
    <View style={styles.pnlWrap}>
      <LinearGradient
        colors={[gradient[0] + '22', gradient[1] + '22']}
        style={[styles.pnlCard, { borderColor: positive ? '#00FF6655' : '#FF334455' }]}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.pnlLabel}>{label}</Text>
          <View style={styles.viewBtn}>
            <Ionicons name="eye-outline" size={10} color={gradient[0]} />
            <Text style={[styles.viewBtnText, { color: gradient[0] }]}>VIEW</Text>
          </View>
        </View>
        <Text
          testID={testID}
          style={{
            ...(typography.metric as any),
            fontSize: 20,
            lineHeight: 26,
            color: positive ? '#00FF66' : '#FF3344',
            marginTop: 4,
          }}
        >
          {positive ? '+' : ''}₹{Math.abs(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </Text>
      </LinearGradient>
    </View>
  );
}

function PositionRow({ p }: { p: any; key?: string | number }) {
  const pnl = Number(p.pnl || p.profitLoss || 0);
  const positive = pnl >= 0;
  return (
    <View style={[styles.posRow, { borderLeftColor: positive ? '#00FF66' : '#FF3344' }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
            {p.symbol || p.tradingSymbol || p.name || 'Position'}
          </Text>
          <Text style={{ color: colors.text.secondary, fontSize: 11, marginTop: 2 }}>
            Qty {p.quantity || 0} • Entry ₹{p.entryPrice || p.avgPrice || 0}{p.ltp ? ` • LTP ₹${p.ltp}` : ''}
          </Text>
        </View>
        <Text style={{ color: positive ? '#00FF66' : '#FF3344', fontWeight: '800', fontSize: 16 }}>
          {positive ? '+' : ''}₹{Math.abs(pnl).toFixed(2)}
        </Text>
      </View>
    </View>
  );
}

function MonitorRow({ m }: { m: any; key?: string | number }) {
  // Monitor item shape (per IndexPilotAI_PositionMonitor_API.md):
  // { positionId, symbol, action: 'HOLD'|'EXIT'|'TRAIL', signal, pnl, currentPrice,
  //   entryPrice, quantity, target, stopLoss, trailingActive, lastChecked, reason }
  const pnl = Number(m.pnl ?? m.profitLoss ?? 0);
  const positive = pnl >= 0;
  const action = String(m.action || m.signal || 'HOLD').toUpperCase();
  const actionColor =
    action === 'EXIT' || action === 'CLOSE' || action === 'SELL' ? '#FF3344'
      : action === 'TRAIL' || action === 'TRAILING' ? '#FFB800'
      : '#00FF66';
  const ltp = Number(m.currentPrice ?? m.ltp ?? m.lastPrice ?? 0);
  const entry = Number(m.entryPrice ?? m.avgPrice ?? 0);
  const qty = Number(m.quantity ?? m.qty ?? 0);
  const target = Number(m.target ?? m.targetAmount ?? 0);
  const stopLoss = Number(m.stopLoss ?? m.stopLossAmount ?? 0);

  return (
    <View style={[styles.monitorRow, { borderLeftColor: actionColor }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }} numberOfLines={1}>
            {m.symbol || m.tradingSymbol || m.name || 'Position'}
          </Text>
          <Text style={{ color: colors.text.secondary, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
            Qty {qty} • E ₹{entry || '—'}{ltp ? ` • L ₹${ltp}` : ''}
            {target ? ` • T ₹${target}` : ''}{stopLoss ? ` • SL ₹${stopLoss}` : ''}
          </Text>
          {m.reason ? (
            <Text style={{ color: '#B49AFF', fontSize: 10, marginTop: 3 }} numberOfLines={2}>
              💡 {m.reason}
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
          <View style={[styles.monitorBadge, { backgroundColor: actionColor + '22', borderColor: actionColor + '88' }]}>
            <Text style={{ color: actionColor, fontWeight: '900', fontSize: 10, letterSpacing: 0.5 }}>{action}</Text>
          </View>
          <Text style={{ color: positive ? '#00FF66' : '#FF3344', fontWeight: '800', fontSize: 14, marginTop: 4 }}>
            {positive ? '+' : ''}₹{Math.abs(pnl).toFixed(2)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.base },
  welcome: { color: '#7C5CFF', fontSize: 11, letterSpacing: 1.5, fontWeight: '800' },
  miniBrokerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(124,92,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(124,92,255,0.25)',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.base,
  },
  miniBrokerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  miniBrokerName: { color: '#fff', fontSize: 14, fontWeight: '800' },
  miniBrokerStatusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  miniBrokerDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  miniBrokerStatus: { fontSize: 11, fontWeight: '700' },
  miniBrokerRight: { flexDirection: 'row', alignItems: 'center' },
  miniBrokerStat: { alignItems: 'center', paddingHorizontal: 10 },
  miniBrokerStatLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  miniBrokerStatValue: { color: '#fff', fontSize: 13, fontWeight: '800', marginTop: 2 },
  miniBrokerDivider: { borderLeftWidth: 1, height: 24, marginHorizontal: 4 },
iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
shareIconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#7C5CFF',
  },
walletCard: {
    borderRadius: radius.lg,
    padding: 1,
  },
  walletInner: {
    backgroundColor: '#08051F',
    borderRadius: radius.lg - 1,
    padding: spacing.lg,
  },
  walletLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  walletAmount: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '900',
    marginTop: 6,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  walletBtn: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  walletBtnGhost: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  marketInd: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  marketDot: { width: 8, height: 8, borderRadius: 4 },
  pnlWrap: { flex: 1 },
  pnlCard: {
    padding: spacing.base,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  pnlLabel: { color: colors.text.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  viewBtnText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  engineCard: {
    marginTop: spacing.base,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  engineCardRunning: { borderColor: '#00FF66', borderWidth: 1.5 },
  engineLabel: { color: colors.text.secondary, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  startBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#00FF66',
    alignItems: 'center', justifyContent: 'center',
  },
  startBtnDisabled: {
    backgroundColor: '#2A2A35',
    opacity: 0.6,
  },
  lowBalanceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,184,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.35)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 12,
  },
  miniAddBtn: {
    backgroundColor: '#FFB800',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  stopBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#FF3344',
    alignItems: 'center', justifyContent: 'center',
  },
  engineMeta: {
    flexDirection: 'row',
    marginTop: spacing.base,
    paddingTop: spacing.base,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  engineMetaItem: { flex: 1, paddingHorizontal: spacing.sm },
  metaLabel: { color: colors.text.disabled, fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  metaValue: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 4, fontVariant: ['tabular-nums'] },
  indexRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.base },
  indexCard: {
    flex: 1,
    padding: spacing.base,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  indexLabel: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  indexLtp: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 4, fontVariant: ['tabular-nums'] },
  sectionTitle: { color: colors.text.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  posRow: {
    backgroundColor: colors.bg.secondary,
    padding: spacing.base,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  monitorRow: {
    backgroundColor: 'rgba(124,92,255,0.08)',
    padding: spacing.base,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: 'rgba(124,92,255,0.25)',
  },
  monitorBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  fundCard: {
    marginTop: spacing.base,
    padding: spacing.base,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(0,180,255,0.25)',
  },
  fundLabel: { color: '#00B4FF', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  tfBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  tfSheet: {
    backgroundColor: '#0A0820',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: 'rgba(124,92,255,0.3)',
  },
  tfOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F0F1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1.5,
  },
  tfBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
tfCancel: {
    paddingVertical: 14,
    alignItems: 'center',
marginTop: 4,
},
  shareSection: {
    marginTop: spacing.base,
    marginBottom: spacing.xs,
  },
  shareSectionLabel: {
    color: colors.text.secondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  // Share icons row (WhatsApp, Telegram, Email)
  shareIconsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.base,
    marginTop: spacing.base,
  },
  // Screenshot modal styles
  screenshotModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.base,
  },
  screenshotModalContent: {
    backgroundColor: '#0A0820',
    borderRadius: radius.xl,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: 'rgba(124, 92, 255, 0.3)',
  },
  screenshotModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  screenshotModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  screenshotLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  screenshotLoadingText: {
    color: colors.text.secondary,
    fontSize: 14,
    marginTop: spacing.base,
  },
  screenshotShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7C5CFF',
    borderRadius: radius.md,
    paddingVertical: 16,
    marginTop: spacing.base,
    flex: 1,
    shadowColor: '#7C5CFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  engineActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.lg,
    paddingVertical: 16,
    marginTop: spacing.base,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  engineActionStop: {
    backgroundColor: 'rgba(255,51,68,0.15)',
    borderColor: '#FF3344',
  },
  engineActionStart: {
    backgroundColor: '#00FF66',
    borderColor: '#00FF66',
  },
  engineActionText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  engineLowFundBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,184,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.3)',
    borderRadius: radius.md,
    paddingVertical: 12,
    marginTop: spacing.sm,
  },
  badgeContainer: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FF3344',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#0A0A0F',
    zIndex: 10,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
  },
  notificationBanner: {
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0,255,102,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,102,0.2)',
    overflow: 'hidden',
  },
  notificationBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  notificationBannerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00FF66',
    marginRight: spacing.sm,
  },
  notificationBannerTextContainer: {
    flex: 1,
  },
  notificationBannerTitle: {
    color: '#00FF66',
    fontSize: 13,
    fontWeight: '700',
  },
  notificationBannerBody: {
    color: '#CCCCCC',
    fontSize: 12,
    marginTop: 2,
  },
  notificationBannerDismiss: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginLeft: spacing.sm,
  },
  backtestBtn: {
    borderRadius: radius.lg,
    marginTop: spacing.base,
    overflow: 'hidden',
    shadowColor: '#7C5CFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  backtestBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    gap: 12,
  },
  backtestBtnTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  backtestBtnSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
});
