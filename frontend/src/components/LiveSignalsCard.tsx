import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../lib/theme';

const INDICES = ['NIFTY', 'BANKNIFTY', 'SENSEX'] as const;
type IndexName = typeof INDICES[number];

type Props = {
  /**
   * latestSignals from /engine/db-status. Shape per index:
   *  { action: 'BUY_PUT'|'BUY_CALL'|'WAIT', confidence: 90, reasoning: '...',
   *    market_state: 'TRENDING_DOWN', confirmations: { total: 7, required: 6 },
   *    bias: 'Bearish'|'Bullish', timeframe: '15M', timestamp: 1777018503549 }
   */
  signals?: any;
  interval?: string; // engine candleInterval ('5'|'15')
};

function fmtSig(idx: IndexName, raw: any) {
  if (!raw) {
    return { signal: 'WAIT', confidence: 0, sentiment: 'Neutral', reason: '', marketState: '', confirmations: '', timestamp: '', interval: '' };
  }
  const action = String(raw.action || raw.signal || '').toUpperCase();
  const signal = action.includes('CALL') ? 'BUY_CALL' : action.includes('PUT') ? 'BUY_PUT' : 'WAIT';
  const conf = Number(raw.confidence || 0);
  const sentiment: 'Bullish' | 'Bearish' | 'Neutral' =
    signal === 'BUY_CALL' ? 'Bullish' : signal === 'BUY_PUT' ? 'Bearish' : (raw.bias || 'Neutral');
  const reason = String(raw.reasoning || raw.reason || '').trim();
  const marketState = String(raw.market_state || raw.marketRegime?.type || '').toUpperCase();
  const confs = raw.confirmations;
  const confirmations = confs && (confs.total !== undefined)
    ? `${confs.total}/${confs.required || 10}` : '';
  const ts = raw.timestamp ? new Date(raw.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
  const interval = raw.timeframe || '';
  return { signal, confidence: conf, sentiment, reason, marketState, confirmations, timestamp: ts, interval };
}

export default function LiveSignalsCard({ signals, interval = '15' }: Props) {
  const fetched = useMemo(() => {
    return INDICES.map((idx) => ({ idx, ...fmtSig(idx, signals?.[idx]) }));
  }, [signals]);

  const updatedAt = signals?.__timestamp ? new Date(signals.__timestamp) : null;

  return (
    <LinearGradient colors={['#0F0A2E', '#0A0820']} style={styles.card}>
      {/* Header */}
      <View style={styles.head}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <Ionicons name="trending-up" size={16} color="#7C5CFF" />
          <Text style={styles.title}>Multi-Symbol AI Signals</Text>
        </View>
        <View style={styles.ivlBadge}>
          <Text style={styles.ivlBadgeText}>{interval}M</Text>
        </View>
      </View>

      <Text style={styles.subtitle}>
        Updates every {interval}-min candle close · synced with engine
      </Text>

      {/* 3-card row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, marginTop: 10 }}>
        {fetched.map((d) => (
          <SignalIndexCard key={d.idx} idx={d.idx} sig={d} />
        ))}
      </ScrollView>

      {updatedAt ? (
        <Text style={{ color: colors.text.disabled, fontSize: 10, textAlign: 'center', marginTop: 10 }}>
          🕒 Last engine signal: {updatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      ) : (
        <Text style={{ color: colors.text.disabled, fontSize: 10, textAlign: 'center', marginTop: 10 }}>
          Waiting for engine to publish first signal…
        </Text>
      )}

      <View style={styles.howItWorks}>
        <Text style={{ color: '#7C5CFF', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 6 }}>
          ⚡ HOW IT WORKS
        </Text>
        <Text style={styles.bullet}>• Engine analyzes all 3 indices independently</Text>
        <Text style={styles.bullet}>• Each candle close ⇒ fresh BUY_CALL / BUY_PUT / WAIT</Text>
        <Text style={styles.bullet}>• ⚡ ONLY ONE order placed per candle (highest confidence)</Text>
      </View>
    </LinearGradient>
  );
}

function SignalIndexCard({ idx, sig }: { idx: IndexName; sig: any }) {
  const isCall = sig.signal === 'BUY_CALL';
  const isPut = sig.signal === 'BUY_PUT';
  const accent = isCall ? '#00FF66' : isPut ? '#FF3344' : '#FFB800';
  const bgGrad: [string, string] = isCall
    ? ['#053D2C', '#001F12']
    : isPut
    ? ['#3D0511', '#1F0008']
    : ['#1F1A0A', '#0F0A05'];

  return (
    <LinearGradient colors={bgGrad} style={[styles.idxCard, { borderColor: accent + '88' }]}>
      <Text style={styles.idxName}>{idx}</Text>
      <Text style={[styles.signalBig, { color: accent }]}>{sig.signal}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 6 }}>
        Confidence: <Text style={{ color: '#fff', fontWeight: '900' }}>{Math.round(sig.confidence)}%</Text>
      </Text>
      <View style={styles.confBarBg}>
        <View style={[styles.confBarFill, { width: `${Math.min(100, Math.max(0, sig.confidence))}%`, backgroundColor: accent }]} />
      </View>
      {sig.timestamp ? (
        <Text style={{ color: colors.text.disabled, fontSize: 10, marginTop: 8 }}>
          {sig.interval || ''} · {sig.timestamp}
        </Text>
      ) : null}
      {sig.reason ? (
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 8, lineHeight: 15 }} numberOfLines={3}>
          {sig.reason.length > 95 ? sig.reason.slice(0, 95) + '…' : sig.reason}
        </Text>
      ) : null}
      {sig.marketState ? (
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 6 }}>
          Market: <Text style={{ color: '#fff' }}>{sig.marketState}</Text>
          {sig.confirmations ? ` · ${sig.confirmations}` : ''}
        </Text>
      ) : null}
      <View style={[styles.sentBadge, { backgroundColor: accent + '33', borderColor: accent }]}>
        <Text style={{ color: accent, fontSize: 11, fontWeight: '900' }}>{sig.sentiment}</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.base,
    borderRadius: radius.lg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: 'rgba(124,92,255,0.3)',
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#fff', fontSize: 13, fontWeight: '800' },
  subtitle: { color: colors.text.disabled, fontSize: 10, marginTop: 2 },
  ivlBadge: {
    backgroundColor: '#7C5CFF',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
  },
  ivlBadgeText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  idxCard: {
    width: 220,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1.5,
    minHeight: 220,
  },
  idxName: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  signalBig: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginTop: 8 },
  confBarBg: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  confBarFill: { height: 4, borderRadius: 2 },
  sentBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 4, borderWidth: 1, marginTop: 10,
  },
  howItWorks: {
    marginTop: 14, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  bullet: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginVertical: 1 },
});
