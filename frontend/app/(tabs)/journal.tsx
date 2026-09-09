import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Card, Heading, Body } from '../../src/components/Primitives';
import { colors, spacing, typography, radius } from '../../src/lib/theme';
import { api } from '../../src/lib/api';

const PERIODS = ['Daily', 'Weekly', 'Monthly', 'Yearly'] as const;

export default function JournalTab() {
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<any[]>([]);
  const [period, setPeriod] = useState<typeof PERIODS[number]>('Monthly');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res: any = await api.getJournal({ limit: 500 });
      const arr = res?.entries || res?.data || [];
      setEntries(Array.isArray(arr) ? arr : []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  // Filter entries by selected period
  const filtered = useMemo(() => {
    const now = new Date();
    return entries.filter((e) => {
      const dt = new Date(e.date || e.entryDate || e.createdAt || e.created_at || 0);
      if (Number.isNaN(dt.getTime())) return false;
      if (period === 'Daily') return dt.toDateString() === now.toDateString();
      if (period === 'Weekly') {
        const diff = (now.getTime() - dt.getTime()) / 86400000;
        return diff >= 0 && diff < 7;
      }
      if (period === 'Monthly') {
        return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
      }
      if (period === 'Yearly') return dt.getFullYear() === now.getFullYear();
      return true;
    });
  }, [entries, period]);

  // Compute real stats client-side
  const stats = useMemo(() => {
    const totalPnL = filtered.reduce((s, e) => s + (Number(e.pnl) || 0), 0);
    const wins = filtered.filter((e) => (Number(e.pnl) || 0) > 0);
    const winRate = filtered.length ? Math.round((wins.length / filtered.length) * 100) : 0;
    const profitDays = new Set(
      filtered
        .filter((e) => (Number(e.pnl) || 0) > 0)
        .map((e) => new Date(e.date || e.createdAt).toDateString())
    ).size;
    const tradingDays = new Set(filtered.map((e) => new Date(e.date || e.createdAt).toDateString())).size;
    const sortedByDate = [...filtered].sort(
      (a, b) =>
        new Date(a.date || a.createdAt).getTime() - new Date(b.date || b.createdAt).getTime()
    );
    let streak = 0,
      bestStreak = 0;
    for (const e of sortedByDate) {
      if ((Number(e.pnl) || 0) > 0) {
        streak++;
        bestStreak = Math.max(bestStreak, streak);
      } else if ((Number(e.pnl) || 0) < 0) {
        streak = 0;
      }
    }
    let mostProfit = 0;
    let mostProfitSym = '';
    const bySym: Record<string, number> = {};
    for (const e of filtered) {
      const sym = e.symbol || e.tradingSymbol || 'Unknown';
      bySym[sym] = (bySym[sym] || 0) + (Number(e.pnl) || 0);
    }
    for (const [s, v] of Object.entries(bySym)) {
      if (v > mostProfit) {
        mostProfit = v;
        mostProfitSym = s;
      }
    }
    return { totalPnL, winRate, profitDays, tradingDays, totalTrades: filtered.length, bestStreak, currentStreak: streak, mostProfit, mostProfitSym };
  }, [filtered]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={{ padding: spacing.base, paddingBottom: 0 }}>
        <Heading variant="h3">Trader's Diary</Heading>
        <View style={styles.periodRow}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p}
              testID={`journal-period-${p.toLowerCase()}`}
              onPress={() => setPeriod(p)}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
            >
              <Text style={{ color: period === p ? '#050505' : '#fff', fontSize: 12, fontWeight: '700' }}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(i, idx) => i.id || String(idx)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#fff" />
        }
contentContainerStyle={{ padding: spacing.base, paddingBottom: insets.bottom + 81 }}
        ListHeaderComponent={
          <View>
            <LinearGradient
              colors={stats.totalPnL >= 0 ? ['#053D2C', '#001F12'] : ['#3D0510', '#1F0006']}
              style={styles.heroPnl}
            >
              <Text style={styles.heroLabel}>NET REALIZED P&L</Text>
              <Text
                style={{
                  fontSize: 36,
                  fontWeight: '900',
                  color: stats.totalPnL >= 0 ? '#00FF66' : '#FF3344',
                  marginTop: 4,
                  fontVariant: ['tabular-nums'],
                }}
                testID="journal-net-pnl"
              >
                {stats.totalPnL >= 0 ? '+' : ''}₹{Math.abs(stats.totalPnL).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 }}>
                {period} • {filtered.length} trades
              </Text>
            </LinearGradient>

            {stats.mostProfitSym ? (
              <Card style={{ marginTop: spacing.sm }}>
                <Text style={styles.smLabel}>MOST PROFITABLE</Text>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15, marginTop: 4 }}>{stats.mostProfitSym}</Text>
                <Text style={{ color: '#00FF66', fontWeight: '800', fontSize: 18, marginTop: 2 }}>
                  +₹{stats.mostProfit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </Text>
              </Card>
            ) : null}

            {/* Stat grid */}
            <View style={styles.statGrid}>
              <StatBox label="WIN RATE" value={`${stats.winRate}%`} color="#00FFE0" testID="journal-win-rate" />
              <StatBox label="TRADES" value={String(stats.totalTrades)} color="#fff" />
              <StatBox label="TRADING DAYS" value={String(stats.tradingDays)} color="#7C5CFF" />
              <StatBox label="PROFIT DAYS" value={String(stats.profitDays)} color="#00FF66" />
              <StatBox label="BEST STREAK" value={`${stats.bestStreak}🔥`} color="#FFB800" />
              <StatBox label="CURRENT" value={String(stats.currentStreak)} color="#FF4DD2" />
            </View>

            <Text style={[styles.section, { marginTop: spacing.lg }]}>RECENT TRADES</Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color="#fff" style={{ marginTop: spacing.xl }} />
          ) : (
            <Card><Body style={{ textAlign: 'center' }}>No trades for this period</Body></Card>
          )
        }
        renderItem={({ item }) => <EntryCard entry={item} />}
      />
    </SafeAreaView>
  );
}

function StatBox({ label, value, color, testID }: any) {
  return (
    <View style={[styles.statBox]}>
      <Text style={styles.smLabel}>{label}</Text>
      <Text testID={testID} style={{ color, fontSize: 18, fontWeight: '800', marginTop: 4, fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}

function EntryCard({ entry }: { entry: any }) {
  const pnl = Number(entry.pnl || 0);
  const positive = pnl >= 0;
  return (
    <View style={[styles.entry, { borderLeftColor: positive ? '#00FF66' : '#FF3344' }]} testID="journal-trade-entry">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{entry.symbol || entry.tradingSymbol}</Text>
          <Text style={{ color: colors.text.secondary, fontSize: 11, marginTop: 3 }}>
            Entry ₹{entry.entryPrice} → Exit ₹{entry.exitPrice} • Qty {entry.quantity}
          </Text>
        </View>
        <Text style={{ color: positive ? '#00FF66' : '#FF3344', fontWeight: '800', fontSize: 16 }}>
          {positive ? '+' : ''}₹{Math.abs(pnl).toFixed(2)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  periodRow: {
    flexDirection: 'row',
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.sm,
    padding: 4,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  periodBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.sm - 2 },
  periodBtnActive: { backgroundColor: '#00FFE0' },
  heroPnl: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  heroLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.sm },
  statBox: {
    flexBasis: '31%',
    flexGrow: 1,
    backgroundColor: colors.bg.secondary,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  smLabel: { color: colors.text.secondary, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  section: { color: colors.text.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  entry: {
    backgroundColor: colors.bg.secondary,
    padding: spacing.base,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
});
