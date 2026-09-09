/**
 * Notification Screen — exact match to the prompt spec.
 *
 * Features:
 * - FlatList-based layout (no complex animations)
 * - Pull-to-refresh
 * - Mark read on tap
 * - Image rendering when data.imageUrl is present
 * - PnL display when data.pnl is present
 * - "No notifications" empty state
 * - Foreground FCM: onMessage → NotificationsAPI.list() to refresh
 */
import { useEffect, useState, useCallback } from 'react';
import {
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  View,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius } from '../lib/theme';
import { NotificationsAPI, Notification } from '../api/notifications-api';
import { NotificationIcon, SECTION_ICON_COLORS } from './icons/AppIcons';

// ─── FOREGROUND FCM REFRESH ──────────────────────────────
// When FCM onMessage fires while the app is open, call
// NotificationsAPI.list() to refresh — the server has already
// stored the notification. Do NOT insert local-only items.
let _foregroundRefreshFn: (() => void) | null = null;

try {
  const { onForegroundMessage } = require('../lib/push-fcm');
  if (typeof onForegroundMessage === 'function') {
    onForegroundMessage(() => {
      if (_foregroundRefreshFn) _foregroundRefreshFn();
    });
  }
} catch {
  // push-fcm may not be available in all environments
}

// ─── MAIN COMPONENT ──────────────────────────────────────
export default function NotificationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load notifications ────────────────────────────────
  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const list = await NotificationsAPI.list();
      setItems(list);
    } catch (e: any) {
      console.warn('[NotificationScreen] Load error:', e?.message);
      setError(e?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Register foreground refresh so FCM onMessage can call it
  useEffect(() => {
    _foregroundRefreshFn = () => load(true);
    return () => { _foregroundRefreshFn = null; };
  }, [load]);

  // ── Mark read on tap ──────────────────────────────────
  const onPress = useCallback(async (n: Notification) => {
    if (!n.read) {
      try {
        await NotificationsAPI.markRead(n.id);
        // Optimistic update
        setItems((prev: Notification[]) =>
          prev.map((item: Notification) => (item.id === n.id ? { ...item, read: true } : item))
        );
      } catch (e: any) {
        console.warn('[NotificationScreen] Mark read error:', e?.message);
      }
    }
    // if (n.data?.targetUrl) Linking.openURL(n.data.targetUrl);
  }, []);

  // ── Mark all read ─────────────────────────────────────
  const handleMarkAll = useCallback(async () => {
    try {
      await NotificationsAPI.markAll();
      setItems((prev: Notification[]) => prev.map((n: Notification) => ({ ...n, read: true })));
    } catch (e: any) {
      console.warn('[NotificationScreen] Mark all error:', e?.message);
    }
  }, []);

  // ── Clear all ─────────────────────────────────────────
  const handleClearAll = useCallback(async () => {
    try {
      await NotificationsAPI.clearAll();
      setItems([]);
    } catch (e: any) {
      console.warn('[NotificationScreen] Clear all error:', e?.message);
    }
  }, []);

  // ── Render item ───────────────────────────────────────
  const renderItem = useCallback(({ item }: { item: Notification }) => {
    const pnl = item.data?.pnl;
    const imageUrl = item.data?.imageUrl;
    const type = item.type || '';

    // Trailing notification icons
    const isTrailingStep = type === 'TRAILING_STEP';
    const isTrailingActivated = type === 'TRAILING_ACTIVATED';

    return (
      <TouchableOpacity
        onPress={() => onPress(item)}
        activeOpacity={0.7}
        style={[
          styles.card,
          item.read ? styles.cardRead : styles.cardUnread,
          (isTrailingStep || isTrailingActivated) && styles.cardTrailing,
        ]}
      >
        <View style={styles.cardRow}>
          {/* Left: title + message */}
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                {isTrailingStep && (
                  <Ionicons name="flash" size={16} color="#FFB800" style={styles.trailingIcon} />
                )}
                {isTrailingActivated && (
                  <Ionicons name="flame" size={16} color="#FF6B00" style={styles.trailingIcon} />
                )}
                <Text
                  style={[styles.title, item.read && styles.titleRead]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
              </View>
              <Text style={styles.time}>
                {formatTime(item.timestamp)}
              </Text>
            </View>

            <Text
              style={[styles.message, item.read && styles.messageRead]}
              numberOfLines={2}
            >
              {item.message}
            </Text>

            {/* PnL badge */}
            {pnl !== undefined && pnl !== null && (
              <Text
                style={[
                  styles.pnl,
                  { color: pnl >= 0 ? '#22c55e' : '#ef4444' },
                ]}
              >
                {pnl >= 0 ? '+' : ''}₹{Number(pnl).toFixed(2)}
              </Text>
            )}
          </View>

          {/* Right: unread dot */}
          {!item.read && <View style={styles.unreadDot} />}
        </View>

        {/* Image (if present) */}
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : null}
      </TouchableOpacity>
    );
  }, [onPress]);

  // ── Empty state ───────────────────────────────────────
  const ListEmptyComponent = useCallback(() => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <NotificationIcon
          size={48}
          color="rgba(255,214,0,0.15)"
          focused
        />
        <Text style={styles.emptyTitle}>No notifications</Text>
        <Text style={styles.emptySubtitle}>
          You'll see notifications here when you receive trade alerts, signals,
          and updates.
        </Text>
      </View>
    );
  }, [loading]);

  // ── Loading state ─────────────────────────────────────
  if (loading && items.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <NotificationIcon size={24} color={SECTION_ICON_COLORS.notifications} focused />
            <Text style={styles.headerTitle}>Notifications</Text>
          </View>
          <View style={{ width: 40 }} />
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7C5CFF" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerActions}>
          {items.some((n: Notification) => !n.read) && (
            <TouchableOpacity onPress={handleMarkAll} style={styles.actionBtn}>
              <Ionicons name="checkmark-done" size={18} color="#00FF66" />
            </TouchableOpacity>
          )}
          {items.length > 0 && (
            <TouchableOpacity onPress={handleClearAll} style={styles.actionBtn}>
              <Ionicons name="trash-outline" size={18} color="#FF3344" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* List */}
      <FlatList
        data={items}
        keyExtractor={(x: Notification) => x.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor="#7C5CFF"
            colors={['#7C5CFF', '#00FF66', '#00B4FF']}
            progressBackgroundColor="#1A1A2E"
          />
        }
        ListEmptyComponent={ListEmptyComponent}
        showsVerticalScrollIndicator={false}
      />

      {/* Error banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color="#FF3344" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => load(true)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── HELPERS ─────────────────────────────────────────────
function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

// ─── STYLES ──────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  listContent: {
    padding: spacing.base,
    paddingBottom: 40,
  },
  card: {
    padding: 14,
    marginHorizontal: 0,
    marginVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  cardRead: {
    backgroundColor: '#111827',
    borderColor: '#1F2937',
  },
  cardUnread: {
    backgroundColor: '#1E293B',
    borderColor: '#3B82F6',
  },
  cardTrailing: {
    backgroundColor: 'rgba(255,184,0,0.08)',
    borderColor: 'rgba(255,184,0,0.4)',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardContent: {
    flex: 1,
    marginRight: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  trailingIcon: {
    marginRight: 6,
  },
  title: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  titleRead: {
    color: '#94a3b8',
  },
  time: {
    color: '#64748b',
    fontSize: 11,
  },
  message: {
    color: '#cbd5e1',
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
  },
  messageRead: {
    color: '#64748b',
  },
  pnl: {
    marginTop: 6,
    fontWeight: '700',
    fontSize: 14,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
    marginTop: 4,
    flexShrink: 0,
  },
  image: {
    width: '100%',
    height: 160,
    marginTop: 10,
    borderRadius: 10,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#888',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  emptySubtitle: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  errorBanner: {
    position: 'absolute',
    bottom: 100,
    left: spacing.base,
    right: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,51,68,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,51,68,0.3)',
  },
  errorText: {
    color: '#FF6677',
    fontSize: 13,
    flex: 1,
  },
  retryText: {
    color: '#FF3344',
    fontSize: 13,
    fontWeight: '700',
  },
});
