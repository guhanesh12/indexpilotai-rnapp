/**
 * useNotifications Hook - Notification data management with auto-polling
 * 
 * Features:
 * - Auto-polling every 30s when screen is focused
 * - Channel filtering (All, Signals, Orders, Wallet, Alerts)
 * - Section grouping (Today, This Week, Earlier)
 * - New notification detection
 * - Mark read, mark all read, clear all
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState, AppStateStatus } from 'react-native';
import { api } from '../lib/api';

export interface Notification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  channel?: string;
  data?: any;
}

export type SortOption = 'newest' | 'oldest' | 'unread';
export type ChannelFilter = 'all' | 'signals' | 'orders' | 'wallet' | 'default';

export interface NotificationSection {
  title: string;
  data: Notification[];
}

const POLL_INTERVAL = 30000; // 30 seconds

function formatTime(iso: string) {
  const d = new Date(iso);
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

function getSectionKey(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'This Week';
  if (diffDays < 30) return 'This Month';
  return 'Earlier';
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const [newNotificationBanner, setNewNotificationBanner] = useState<{ title: string; body: string } | null>(null);

  const prevCountRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFocusedRef = useRef(false);
  const initialLoadRef = useRef(true); // Track initial load to avoid false "new notification" banner

  const fetchNotifications = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      }
      setError(null);
      
      const data: any = await api.getNotifications();
      const list = data?.notifications ?? data?.data ?? data ?? [];
      const arr = Array.isArray(list) ? list : [];
      
      // Detect new notifications - skip on initial load to prevent "100 notifications available" bug
      if (!initialLoadRef.current && prevCountRef.current > 0 && arr.length > prevCountRef.current) {
        const newCount = arr.length - prevCountRef.current;
        const newest = arr.slice(0, newCount);
        if (newest.length > 0) {
          setHasNewNotifications(true);
          setNewNotificationBanner({
            title: newest[0].title || 'New Notification',
            body: `${newCount} new notification${newCount > 1 ? 's' : ''}`,
          });
          // Auto-hide banner after 5s
          setTimeout(() => {
            setNewNotificationBanner(null);
            setHasNewNotifications(false);
          }, 5000);
        }
      }
      
      prevCountRef.current = arr.length;
      initialLoadRef.current = false; // Mark initial load as complete after first fetch
      setNotifications(arr);
    } catch (e: any) {
      setError(e?.message || 'Failed to load notifications');
      console.warn('[useNotifications] Fetch error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Polling when focused + app active
  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      
      // Start poll interval
      pollTimerRef.current = setInterval(() => {
        if (isFocusedRef.current) {
          fetchNotifications();
        }
      }, POLL_INTERVAL);
      
      // Fetch immediately on focus
      fetchNotifications();
      
      return () => {
        isFocusedRef.current = false;
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      };
    }, [fetchNotifications])
  );

  // Pause polling when app goes to background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active' && isFocusedRef.current) {
        fetchNotifications();
      }
    });
    return () => subscription.remove();
  }, [fetchNotifications]);

  const onRefresh = useCallback(async () => {
    await fetchNotifications(true);
  }, [fetchNotifications]);

  const handleMarkRead = useCallback(async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (e: any) {
      console.warn('[useNotifications] Mark read error:', e?.message);
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (e: any) {
      console.warn('[useNotifications] Mark all read error:', e?.message);
    }
  }, []);

  const handleClearAll = useCallback(async () => {
    try {
      await api.clearNotifications();
      setNotifications([]);
      prevCountRef.current = 0;
    } catch (e: any) {
      console.warn('[useNotifications] Clear error:', e?.message);
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    // Optimistic removal
    setNotifications(prev => prev.filter(n => n.id !== id));
    // Actually delete via API (clear is the only delete endpoint)
    try {
      // For individual delete, we'll just mark as read since clear is the only option
      await api.markNotificationRead(id);
    } catch (e: any) {
      console.warn('[useNotifications] Delete error:', e?.message);
    }
  }, []);

  // Filter and sort
  const filteredNotifications = notifications.filter(n => {
    if (channelFilter === 'all') return true;
    return (n.channel || 'default') === channelFilter;
  });

  const sortedNotifications = [...filteredNotifications].sort((a, b) => {
    if (sortBy === 'unread') {
      if (a.read !== b.read) return a.read ? 1 : -1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    if (sortBy === 'oldest') {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Group into sections
  const groupedSections: NotificationSection[] = (() => {
    const groups: Record<string, Notification[]> = {};
    for (const n of sortedNotifications) {
      const key = getSectionKey(n.created_at);
      if (!groups[key]) groups[key] = [];
      groups[key].push(n);
    }
    const sectionOrder = ['Today', 'Yesterday', 'This Week', 'This Month', 'Earlier'];
    return sectionOrder
      .filter(key => groups[key]?.length > 0)
      .map(key => ({ title: key, data: groups[key] }));
  })();

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications: sortedNotifications,
    groupedNotifications: groupedSections,
    loading,
    refreshing,
    error,
    unreadCount,
    hasNewNotifications,
    newNotificationBanner,
    sortBy,
    channelFilter,
    setSortBy,
    setChannelFilter,
    onRefresh,
    markRead: handleMarkRead,
    markAllRead: handleMarkAllRead,
    clearAll: handleClearAll,
    deleteNotification: handleDelete,
    dismissBanner: () => setNewNotificationBanner(null),
    formatTime,
  };
}
