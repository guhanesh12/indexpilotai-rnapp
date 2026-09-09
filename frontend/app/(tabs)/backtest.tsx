import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  AppState,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { colors, spacing, typography, radius } from '../../src/lib/theme';
import { backtestApi, type BacktestResult, type BacktestRunRow, type IndexName } from '../../src/lib/backtestApi';
import { useBacktestRun } from '../../src/hooks/useBacktestRun';

const INDICES: { key: IndexName; label: string; lot: number }[] = [
  { key: 'NIFTY', label: 'NIFTY', lot: 65 },
  { key: 'BANKNIFTY', label: 'BANKNIFTY', lot: 30 },
  { key: 'SENSEX', label: 'SENSEX', lot: 20 },
];

const DURATIONS = [
  { label: '1 Month', days: 30 },
  { label: '3 Months', days: 91 },
  { label: '6 Months', days: 182 },
  { label: '1 Year', days: 365 },
];

const QUICK_CAPITALS = [100000, 500000, 1000000, 2500000];
const MAX_TRADES = [1, 2, 3, 5, 0];

export default function BacktestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bt = useBacktestRun();

  const [strategy, setStrategy] = useState('indexpilotai');
  const [indices, setIndices] = useState<IndexName[]>(['NIFTY', 'BANKNIFTY', 'SENSEX']);
  const [capital, setCapital] = useState(1000000);
  const [durationDays, setDurationDays] = useState(365);
  const [lots, setLots] = useState<Record<IndexName, number>>({ NIFTY: 1, BANKNIFTY: 1, SENSEX: 1 });
  const [maxTradesPerDay, setMaxTradesPerDay] = useState(2);
  const [minConfidence, setMinConfidence] = useState(70);
  const [historyDetail, setHistoryDetail] = useState<BacktestRunRow & { report: BacktestResult } | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');

  const resultsOpacity = useSharedValue(0);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    if (bt.report && !bt.loading) {
      resultsOpacity.value = withTiming(1, { duration: 600 });
    }
  }, [bt.report, bt.loading]);

  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1200 }), -1, true);
  }, []);

  useEffect(() => {
    bt.loadHistory();
    bt.loadWallet();
  }, [bt.loadHistory, bt.loadWallet]);

  useEffect(() => {
    return () => {
      if (bt.loading) {
        bt.cancel();
      }
    };
  }, [bt.loading, bt.cancel]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' && bt.loading) {
        bt.cancel();
      }
    });
    return () => subscription.remove();
  }, [bt.loading, bt.cancel]);

  const today = new Date();
  const toDate = useMemo(() => today.toISOString().slice(0, 10), []);
  const fromDate = useMemo(() => {
    const d = new Date(Date.now() - durationDays * 86400000);
    return d.toISOString().slice(0, 10);
  }, [durationDays]);

  const toggleIndex = (idx: IndexName) => {
    setIndices((prev) => (prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]));
    setLots((prev) => ({ ...prev, [idx]: prev[idx] || 1 }));
  };

  const handleRun = async () => {
    if (indices.length === 0) {
      Alert.alert('Validation', 'Select at least one index.');
      return;
    }
    if (capital < 10000) {
      Alert.alert('Validation', 'Minimum capital is ₹10,000.');
      return;
    }
    if (bt.loading) return;
    resultsOpacity.value = 0;
    await bt.run({
      strategy,
      indices,
      initialCapital: capital,
      fromDate,
      toDate,
      lots,
      maxTradesPerDay,
      minConfidence,
    });
  };

  const handleExportCSV = async (report: BacktestResult) => {
    try {
      const rows = [
        ['Index', 'Direction', 'Entry', 'Exit', 'Lots', 'P&L', 'Reason'],
        ...report.trades.map((t) => [
          t.index,
          t.direction,
          t.entryTime,
          t.exitTime,
          String(t.lots),
          String(Math.round(t.pnl)),
          t.reason,
        ]),
      ];
      const csv = rows.map((r) => r.join(',')).join('\n');
      const fileName = `IndexPilotAI_Backtest_${report.fromDate}_${report.toDate}.csv`;
      const fileUri = FileSystem.documentDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, csv);
      await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export Backtest CSV' });
    } catch (e: any) {
      Alert.alert('Export failed', e?.message || 'Could not export CSV');
    }
  };

  const openHistoryDetail = async (run: BacktestRunRow) => {
    try {
      const data = await backtestApi.getRun(run.id);
      setHistoryDetail(data.run);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not load run details');
    }
  };

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + shimmer.value * 0.4,
  }));

  const resultsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: resultsOpacity.value,
  }));

  const renderSkeleton = () => (
    <View style={styles.skeletonContainer}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[styles.skeletonCard, shimmerStyle]} />
      ))}
    </View>
  );

  const renderStatCard = (title: string, value: string, sub: string, positive: boolean) => (
    <View style={[styles.statCard, { borderColor: positive ? 'rgba(0,255,102,0.15)' : 'rgba(255,51,68,0.15)' }]}>
      <Text style={[styles.statTitle, { color: colors.text.secondary }]}>{title}</Text>
      <Text style={[styles.statValue, { color: positive ? colors.trading.profit : colors.trading.loss }]}>{value}</Text>
      <Text style={[styles.statSub, { color: colors.text.disabled }]}>{sub}</Text>
    </View>
  );

  const renderPnlBars = (data: { period: string; pnl: number; trades: number }[]) => {
    if (!data || data.length === 0) {
      return <Text style={[styles.emptyText, { color: colors.text.disabled }]}>No trades in this period.</Text>;
    }
    const maxAbs = Math.max(...data.map((d) => Math.abs(d.pnl)), 1);
    const sorted = [...data].sort((a, b) => b.period.localeCompare(a.period));
    return sorted.map((item, idx) => {
      const positive = item.pnl >= 0;
      const width = Math.max(3, (Math.abs(item.pnl) / maxAbs) * 100);
      return (
        <View key={item.period + idx} style={{ marginBottom: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ color: colors.text.primary, fontSize: 12, fontWeight: '700' }}>{item.period}</Text>
            <Text style={{ color: positive ? colors.trading.profit : colors.trading.loss, fontSize: 12, fontWeight: '800' }}>
              {positive ? '+' : ''}₹{Math.abs(Math.round(item.pnl)).toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 4, overflow: 'hidden' }}>
            <View
              style={{
                width: `${width}%`,
                height: '100%',
                backgroundColor: positive ? colors.trading.profit : colors.trading.loss,
                borderRadius: 4,
                opacity: 0.85,
              }}
            />
          </View>
        </View>
      );
    });
  };

  const renderResults = (report?: BacktestResult | null) => {
    const r = report || bt.report;
    if (!r || !r.summary) return null;
    const s = r.summary;
    return (
      <Animated.View style={[styles.resultsContainer, resultsAnimatedStyle]}>
        {/* Stat cards */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.base }}>
          {renderStatCard('Net Profit', `₹${Math.round(s.netPnL || 0).toLocaleString('en-IN')}`, `ROI ${(s.roi || 0).toFixed(1)}%`, (s.netPnL || 0) >= 0)}
          {renderStatCard('Win Rate', `${(s.winRate || 0).toFixed(1)}%`, `${s.wins || 0}W / ${s.losses || 0}L`, (s.winRate || 0) >= 50)}
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.base }}>
          {renderStatCard('Profit Days', `${s.profitDays || 0}`, `${(s.dayWinRate || 0).toFixed(1)}% of ${s.tradingDays || 0} days`, true)}
          {renderStatCard('Loss Days', `${s.lossDays || 0}`, `Flat ${s.flatDays || 0}`, false)}
        </View>

        {/* Earnings Projection */}
        <View style={[styles.sectionCard, { marginBottom: spacing.base }]}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary, marginBottom: spacing.sm }]}>
            Earnings Projection on ₹{(r.initialCapital || 0).toLocaleString('en-IN')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {[
              { label: 'Daily', value: `₹${Math.round(s.avgDaily || 0).toLocaleString('en-IN')}` },
              { label: 'Weekly', value: `₹${Math.round(s.avgWeekly || 0).toLocaleString('en-IN')}` },
              { label: 'Monthly', value: `₹${Math.round(s.avgMonthly || 0).toLocaleString('en-IN')}` },
              { label: 'Yearly', value: `₹${Math.round(s.projectedYearly || 0).toLocaleString('en-IN')}` },
            ].map((item) => (
              <View key={item.label} style={[styles.projChip, { borderColor: 'rgba(255,255,255,0.08)' }]}>
                <Text style={{ color: colors.text.disabled, fontSize: 10, fontWeight: '700' }}>{item.label}</Text>
                <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '800', marginTop: 2 }}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* P&L Breakdown */}
        <View style={[styles.sectionCard, { marginBottom: spacing.base }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>P&L Breakdown</Text>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setSelectedPeriod(p)}
                  style={[
                    styles.periodChip,
                    selectedPeriod === p && { backgroundColor: 'rgba(0,255,102,0.15)', borderColor: 'rgba(0,255,102,0.4)' },
                    selectedPeriod !== p && { borderColor: 'rgba(255,255,255,0.08)' },
                  ]}
                >
                  <Text style={[styles.periodChipText, { color: selectedPeriod === p ? colors.trading.profit : colors.text.secondary }]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
            {renderPnlBars((r[selectedPeriod] || []).length > 0 ? r[selectedPeriod] : [])}
        </View>

        {/* Index Performance */}
        <View style={[styles.sectionCard, { marginBottom: spacing.base }]}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary, marginBottom: spacing.sm }]}>Index Performance</Text>
          {(r.byIndex || []).map((idx) => (
            <View key={idx.index} style={{ marginBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: colors.text.primary, fontWeight: '800', fontSize: 14 }}>{idx.index}</Text>
                <Text style={{ color: (idx.pnl || 0) >= 0 ? colors.trading.profit : colors.trading.loss, fontWeight: '800', fontSize: 14 }}>
                  ₹{Math.round(idx.pnl || 0).toLocaleString('en-IN')}
                </Text>
              </View>
              <Text style={{ color: colors.text.secondary, fontSize: 12, marginTop: 2 }}>
                {idx.trades || 0} trades • {(idx.winRate || 0).toFixed(1)}% win rate
              </Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
            {[
              { label: 'Profit Factor', value: (s.profitFactor || 0).toFixed(2) },
              { label: 'Max Drawdown', value: `${(s.maxDrawdown || 0).toFixed(1)}%` },
              { label: 'Avg Win', value: `₹${Math.round(s.avgWin || 0).toLocaleString('en-IN')}` },
              { label: 'Avg Loss', value: `₹${Math.round(Math.abs(s.avgLoss || 0)).toLocaleString('en-IN')}` },
              { label: 'Best Trade', value: `₹${Math.round(s.bestTrade || 0).toLocaleString('en-IN')}` },
              { label: 'Worst Trade', value: `₹${Math.round(s.worstTrade || 0).toLocaleString('en-IN')}` },
            ].map((m) => (
              <View key={m.label} style={[styles.miniStat, { borderColor: 'rgba(255,255,255,0.06)' }]}>
                <Text style={{ color: colors.text.disabled, fontSize: 10, fontWeight: '700' }}>{m.label}</Text>
                <Text style={{ color: colors.text.primary, fontSize: 12, fontWeight: '800', marginTop: 2 }}>{m.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Recent Trades */}
        <View style={[styles.sectionCard, { marginBottom: spacing.base }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Recent Trades ({Math.min((r.trades || []).length, 50)})</Text>
            <TouchableOpacity onPress={() => handleExportCSV(r)} style={styles.csvBtn}>
              <Ionicons name="download-outline" size={14} color={colors.brand.primary} />
              <Text style={{ color: colors.brand.primary, fontSize: 12, fontWeight: '800', marginLeft: 4 }}>CSV</Text>
            </TouchableOpacity>
          </View>
          {(r.trades || []).length === 0 ? (
            <Text style={{ color: colors.text.disabled }}>No trades to display.</Text>
          ) : (
            <ScrollView horizontal>
              <View>
                <View style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
                  {['Index', 'Side', 'Entry', 'Exit', 'Lots', 'P&L'].map((h) => (
                    <Text key={h} style={[styles.tableHeader, { flex: h === 'P&L' ? 1 : h === 'Index' ? 1.2 : 1 }]}>{h}</Text>
                  ))}
                </View>
                {(r.trades || []).slice(0, 50).map((t, i) => (
                  <View key={i} style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' }}>
                    <Text style={[styles.tableCell, { flex: 1.2, color: colors.text.primary }]}>{t.index}</Text>
                    <Text style={[styles.tableCell, { flex: 1, color: t.direction === 'BUY_CALL' ? colors.trading.profit : colors.trading.loss }]}>
                      {t.direction.replace('BUY_', '')}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 1, color: colors.text.secondary }]}>{t.entryPrice.toFixed(2)}</Text>
                    <Text style={[styles.tableCell, { flex: 1, color: colors.text.secondary }]}>{t.exitPrice.toFixed(2)}</Text>
                    <Text style={[styles.tableCell, { flex: 1, color: colors.text.secondary }]}>{t.lots}</Text>
                    <Text style={[styles.tableCell, { flex: 1, color: (t.pnl || 0) >= 0 ? colors.trading.profit : colors.trading.loss }]}>
                      {(t.pnl || 0) >= 0 ? '+' : ''}₹{Math.round(t.pnl || 0).toLocaleString('en-IN')}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </View>

        <Text style={{ color: colors.text.disabled, fontSize: 11, lineHeight: 16, marginBottom: spacing.lg, textAlign: 'center' }}>
          Backtests simulate ATM option trades from real index candles including brokerage, taxes and slippage. Past performance does not guarantee future returns.
        </Text>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg.primary }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.base, paddingBottom: 32 + insets.bottom + 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient
          colors={['rgba(124,92,255,0.12)', 'rgba(0,255,102,0.06)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={styles.headerIcon}>
              <Ionicons name="flask" size={20} color="#00FF66" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text.primary, fontSize: 20, fontWeight: '900', letterSpacing: 0.3 }}>Strategy Backtest</Text>
              <Text style={{ color: colors.text.secondary, fontSize: 12, marginTop: 2 }}>
                Replay AI signals on real market data
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.sm }}>
            <View style={[styles.chip, { borderColor: 'rgba(251,191,36,0.3)', backgroundColor: 'rgba(251,191,36,0.08)' }]}>
              <Text style={{ color: '#FFB800', fontSize: 11, fontWeight: '800' }}>₹5 / run</Text>
            </View>
            <View style={[styles.chip, { borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)' }]}>
              <Text style={{ color: colors.text.primary, fontSize: 11, fontWeight: '800' }}>₹{bt.wallet?.toLocaleString('en-IN') || '—'}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Config Card */}
        <View style={[styles.sectionCard, { marginBottom: spacing.base, marginTop: spacing.base }]}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary, marginBottom: spacing.md }]}>Strategy</Text>
          <View style={[styles.strategyCard, { borderColor: 'rgba(0,255,102,0.3)', backgroundColor: 'rgba(0,255,102,0.06)' }]}>
            <View>
              <Text style={{ color: colors.text.primary, fontWeight: '800', fontSize: 15 }}>IndexPilotAI Strategy</Text>
              <Text style={{ color: colors.text.secondary, fontSize: 12, marginTop: 2 }}>
                Default multi-confirmation AI engine
              </Text>
            </View>
            <View style={{ backgroundColor: 'rgba(0,255,102,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
              <Text style={{ color: colors.trading.profit, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 }}>DEFAULT</Text>
            </View>
          </View>

          <Text style={[styles.label, { marginTop: spacing.base }]}>Investment Amount (₹)</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              keyboardType="numeric"
              value={String(capital)}
              onChangeText={(t) => setCapital(Number(t.replace(/[^0-9]/g, '')) || 0)}
            />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {QUICK_CAPITALS.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setCapital(c)}
                style={[
                  styles.chip,
                  capital === c && { backgroundColor: 'rgba(0,191,255,0.12)', borderColor: 'rgba(0,191,255,0.35)' },
                ]}
              >
                <Text style={[styles.chipText, { color: capital === c ? '#00BFFF' : colors.text.primary }]}>
                  ₹{(c / 100000).toFixed(c >= 1000000 ? 0 : 1)}L
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { marginTop: spacing.base }]}>Duration</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {DURATIONS.map((d) => (
              <TouchableOpacity
                key={d.days}
                onPress={() => setDurationDays(d.days)}
                style={[
                  styles.chip,
                  durationDays === d.days && { backgroundColor: 'rgba(0,191,255,0.12)', borderColor: 'rgba(0,191,255,0.35)' },
                ]}
              >
                <Text style={[styles.chipText, { color: durationDays === d.days ? '#00BFFF' : colors.text.primary }]}>
                  {d.label} ({d.days})
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { marginTop: spacing.base }]}>Indices & Lots per trade</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
            {INDICES.map(({ key, label, lot }) => {
              const selected = indices.includes(key);
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => toggleIndex(key)}
                  style={[
                    styles.indexTile,
                    { borderColor: selected ? 'rgba(0,255,102,0.35)' : 'rgba(255,255,255,0.06)', opacity: selected ? 1 : 0.6 },
                  ]}
                >
                  <Text style={{ color: colors.text.primary, fontWeight: '800', fontSize: 13 }}>
                    {selected ? '✓ ' : ''}{label}
                  </Text>
                  <TextInput
                    style={[styles.lotInput, { color: colors.text.primary, opacity: selected ? 1 : 0.4 }]}
                    keyboardType="numeric"
                    value={String(lots[key] || 0)}
                    editable={selected}
                    onChangeText={(t) => {
                      const v = Math.min(50, Math.max(0, Number(t) || 0));
                      setLots((prev) => ({ ...prev, [key]: v }));
                    }}
                  />
                  <Text style={{ color: colors.text.disabled, fontSize: 10 }}>× {lot} qty</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.label, { marginTop: spacing.base }]}>Max trades per day (per index)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm }}>
            {MAX_TRADES.map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => setMaxTradesPerDay(m)}
                style={[
                  styles.chip,
                  maxTradesPerDay === m && { backgroundColor: 'rgba(0,191,255,0.12)', borderColor: 'rgba(0,191,255,0.35)' },
                ]}
              >
                <Text style={[styles.chipText, { color: maxTradesPerDay === m ? '#00BFFF' : colors.text.primary }]}>
                  {m === 0 ? 'Unlimited' : m}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ color: colors.text.disabled, fontSize: 11, marginBottom: spacing.sm }}>
            Fewer trades per day = less churn. Total daily trades ≈ selected indices × this limit.
          </Text>

          <Text style={[styles.label, { marginTop: spacing.base }]}>
            Minimum signal confidence — {minConfidence}%
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
              <View style={{ width: `${(minConfidence / 95) * 100}%`, height: '100%', backgroundColor: '#00BFFF', borderRadius: 3 }} />
            </View>
          </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <TouchableOpacity onPress={() => setMinConfidence(Math.max(0, minConfidence - 5))}>
                <Text style={{ color: colors.text.secondary, fontSize: 18 }}>−</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMinConfidence(Math.min(95, minConfidence + 5))}>
                <Text style={{ color: colors.text.secondary, fontSize: 18 }}>+</Text>
              </TouchableOpacity>
            </View>
          <Text style={{ color: colors.text.disabled, fontSize: 11, marginBottom: spacing.sm }}>
            Higher = only the strongest setups are traded.
          </Text>

          {/* Run Button */}
          <TouchableOpacity
            onPress={handleRun}
            disabled={bt.loading}
            activeOpacity={0.8}
            style={{ marginTop: spacing.base }}
          >
            <LinearGradient
              colors={bt.loading ? ['#374151', '#1F2937'] : ['#10B981', '#3B82F6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.runBtn, bt.loading && { opacity: 0.7 }]}
            >
              {bt.loading ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>
                    Running backtest… {bt.progress}%
                  </Text>
                </View>
              ) : (
                <Text style={{ color: '#050505', fontWeight: '900', fontSize: 15, letterSpacing: 0.3 }}>
                  Run Backtest — ₹5
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
          {bt.loading && (
            <View style={{ marginTop: spacing.sm }}>
              <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                <View
                  style={{
                    width: `${Math.max(4, bt.progress)}%`,
                    height: '100%',
                    backgroundColor: '#10B981',
                    borderRadius: 3,
                  }}
                />
              </View>
              <Text style={{ color: colors.text.disabled, fontSize: 11, marginTop: 4, textAlign: 'center' }}>
                Replaying AI signals on historical data…
              </Text>
            </View>
          )}
          {bt.error && (
            <View style={[styles.errorBanner, { borderColor: 'rgba(255,51,68,0.3)', backgroundColor: 'rgba(255,51,68,0.08)' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="warning" size={18} color="#FF3344" />
                <Text style={{ color: colors.trading.loss, fontSize: 13, fontWeight: '700', flex: 1 }}>{bt.error}</Text>
              </View>
              <TouchableOpacity onPress={handleRun} style={styles.retryBtn}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Results */}
        {bt.loading ? renderSkeleton() : renderResults()}

        {/* History */}
        {bt.history.length > 0 && (
          <View style={[styles.sectionCard, { marginBottom: spacing.base }]}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary, marginBottom: spacing.sm }]}>My Backtest History</Text>
            {bt.history.map((run) => (
              <TouchableOpacity
                key={run.id}
                onPress={() => openHistoryDetail(run)}
                style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text.primary, fontWeight: '800', fontSize: 13 }}>
                      {run.from_date} → {run.to_date}
                    </Text>
                    <Text style={{ color: colors.text.secondary, fontSize: 11, marginTop: 2 }}>
                      ₹{run.initial_capital.toLocaleString('en-IN')} • {run.indices.join(', ')} • {run.summary?.totalTrades || 0} trades
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: (run.summary?.netPnL || 0) >= 0 ? colors.trading.profit : colors.trading.loss, fontWeight: '900', fontSize: 13 }}>
                      ₹{Math.round(run.summary?.netPnL || 0).toLocaleString('en-IN')}
                    </Text>
                    <Text style={{ color: colors.text.secondary, fontSize: 11 }}>
                      {run.summary?.winRate?.toFixed(1) || 0}% win
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* History Detail Modal */}
      <Modal visible={!!historyDetail} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg.primary }}>
          <View style={styles.modalHeader}>
            <Text style={{ color: colors.text.primary, fontWeight: '900', fontSize: 18 }}>Backtest Detail</Text>
            <TouchableOpacity onPress={() => setHistoryDetail(null)} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
          {historyDetail && (
            <ScrollView contentContainerStyle={{ padding: spacing.base }}>
              <View style={[styles.dateBadge, { backgroundColor: 'rgba(124,92,255,0.1)', borderColor: 'rgba(124,92,255,0.2)' }]}>
                <Text style={{ color: '#7C5CFF', fontSize: 12, fontWeight: '700' }}>
                  {historyDetail.from_date} → {historyDetail.to_date}
                </Text>
              </View>
              {historyDetail && renderResults(historyDetail.report)}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerGradient: {
    borderRadius: radius.lg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,255,102,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: spacing.base,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  label: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: spacing.base,
    paddingVertical: 12,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  strategyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.base,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  indexTile: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm,
    alignItems: 'center',
    gap: 6,
  },
  lotInput: {
    width: 48,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    paddingVertical: 4,
  },
  runBtn: {
    paddingVertical: 16,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  retryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,51,68,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,51,68,0.3)',
  },
  skeletonContainer: {
    gap: spacing.sm,
  },
  skeletonCard: {
    height: 120,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  resultsContainer: {
    gap: spacing.base,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm,
  },
  statTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  statValue: { fontSize: 16, fontWeight: '900', marginTop: 2 },
  statSub: { fontSize: 11, marginTop: 2 },
  projChip: {
    flex: 1,
    minWidth: 70,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm,
    alignItems: 'center',
  },
  periodChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  periodChipText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  miniStat: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm,
    minWidth: 90,
  },
  csvBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(0,191,255,0.25)',
    backgroundColor: 'rgba(0,191,255,0.06)',
  },
  tableHeader: {
    color: colors.text.disabled,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
    paddingHorizontal: 4,
  },
  tableCell: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: spacing.base,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginBottom: spacing.base,
  },
});
