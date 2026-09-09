import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Heading, Body } from '../../src/components/Primitives';
import { colors, spacing, radius } from '../../src/lib/theme';
import { api } from '../../src/lib/api';

const TYPES = ['ALL', 'SIGNAL', 'ORDER', 'INFO', 'SUCCESS', 'ERROR', 'ENGINE_STOP'];

const typeStyle = (t: string) => {
  const T = (t || '').toUpperCase();
  if (T === 'ERROR') return { bg: 'rgba(255,51,68,0.12)', fg: colors.trading.loss };
  if (T === 'ORDER') return { bg: 'rgba(255,184,0,0.15)', fg: colors.trading.warning };
  if (T === 'SIGNAL' || T === 'SUCCESS') return { bg: 'rgba(0,255,102,0.12)', fg: colors.trading.profit };
  if (T === 'ENGINE_STOP' || T === 'ENGINE_START') return { bg: 'rgba(0,180,255,0.12)', fg: '#00B4FF' };
  return { bg: 'rgba(255,255,255,0.06)', fg: colors.text.secondary };
};

export default function LogsTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [logs, setLogs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res: any = await api.getLogs();
      const list = res?.logs || res?.data || [];
      setLogs(Array.isArray(list) ? list : []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const clearAll = () => {
    Alert.alert('Clear all logs', 'This cannot be undone', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.clearLogs();
            setLogs([]);
          } catch (e: any) {
            Alert.alert('Failed', e.message);
          }
        },
      },
    ]);
  };

  const filtered = filter === 'ALL'
    ? logs
    : logs.filter((l) => (l.type || l.action || '').toUpperCase().includes(filter));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
<View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Heading variant="h3">Advanced AI Logs</Heading>
          <Text style={{ color: colors.text.secondary, fontSize: 11, marginTop: 2 }}>
            {logs.length} entries · auto-refresh 5s
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity testID="profile-button" onPress={() => router.push('/(tabs)/profile')} style={styles.profileBtn}>
            <Ionicons name="person-outline" size={14} color={colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity testID="logs-clear-button" onPress={clearAll} style={styles.clearBtn}>
            <Ionicons name="trash-outline" size={14} color={colors.trading.loss} />
            <Text style={{ color: colors.trading.loss, fontSize: 12, fontWeight: '700' }}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {TYPES.map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setFilter(t)}
            testID={`log-filter-${t.toLowerCase()}`}
            style={[styles.chip, filter === t && styles.chipActive]}
          >
            <Text style={{
              color: filter === t ? '#050505' : colors.text.primary,
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 0.5,
            }}>
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        testID="logs-terminal-view"
        data={filtered}
        keyExtractor={(i, idx) => i.id || String(idx)}
contentContainerStyle={{ padding: spacing.base, paddingBottom: insets.bottom + 81 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#fff" />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name={loading ? 'sync-outline' : 'terminal-outline'} size={40} color={colors.text.disabled} />
            <Body style={{ textAlign: 'center', marginTop: spacing.base }}>
              {loading ? 'Loading logs…' : 'No logs match this filter'}
            </Body>
          </View>
        }
        renderItem={({ item }) => <LogRow item={item} />}
      />
    </SafeAreaView>
  );
}

function LogRow({ item }: { item: any }) {
  const t = item.type || item.action || 'INFO';
  const style = typeStyle(t);
  const time = item.timestamp || item.createdAt || item.created_at;
  let timeStr = '';
  if (time) {
    try {
      timeStr = new Date(typeof time === 'number' ? time : time).toLocaleTimeString('en-GB');
    } catch {
      timeStr = '';
    }
  }
  return (
    <View style={styles.logRow} testID="log-entry">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Text style={{ color: colors.text.disabled, fontSize: 11, fontVariant: ['tabular-nums'], minWidth: 64 }}>
          {timeStr}
        </Text>
        <View style={[styles.typeBadge, { backgroundColor: style.bg }]}>
          <Text style={{ color: style.fg, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 }}>
            {String(t).toUpperCase()}
          </Text>
        </View>
      </View>
      <Text style={styles.msg}>{item.message || item.msg || JSON.stringify(item)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.base,
  },
profileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.trading.loss,
    backgroundColor: 'rgba(255,51,68,0.08)',
  },
  chipRow: { paddingHorizontal: spacing.base, paddingBottom: 6, alignItems: 'center', gap: 6 },
  chip: {
    backgroundColor: colors.bg.secondary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignSelf: 'center',
  },
  chipActive: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
  logRow: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.sm,
    padding: spacing.sm + 2,
    marginBottom: 6,
    borderLeftWidth: 2,
    borderLeftColor: colors.border.default,
  },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 3 },
  msg: { color: colors.text.primary, fontSize: 12, lineHeight: 16 },
  empty: { alignItems: 'center', padding: spacing.xl, marginTop: spacing.xl },
});
