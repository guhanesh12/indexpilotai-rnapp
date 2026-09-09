import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, Heading, Body, Button, Chip } from '../../src/components/Primitives';
import { colors, spacing, typography, radius } from '../../src/lib/theme';
import { api } from '../../src/lib/api';

const INDICES = ['NIFTY', 'BANKNIFTY', 'SENSEX'];
const INTERVALS = ['5', '15', '30', '60'];

export default function StrategiesTab() {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState('NIFTY');
  const [interval, setInterval] = useState('15');
  const [loading, setLoading] = useState(false);
  const [signal, setSignal] = useState<any>(null);

  const fetchSignal = async () => {
    setLoading(true);
    setSignal(null);
    try {
      const res: any = await api.getAISignal({ index, interval, accountBalance: 50000 });
      setSignal(res?.signal || res);
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
<ScrollView contentContainerStyle={{ padding: spacing.base, paddingBottom: insets.bottom + 81 }}>
        <Heading variant="h3" style={{ marginBottom: spacing.base }}>AI Strategies</Heading>

        <View style={styles.hero}>
          <Image
            source={{ uri: 'https://images.pexels.com/photos/6203470/pexels-photo-6203470.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940' }}
            style={styles.heroBg}
            blurRadius={2}
          />
          <View style={styles.heroOverlay} />
          <View style={{ padding: spacing.lg }}>
            <Text style={{ color: colors.trading.profit, fontSize: 11, fontWeight: '700', letterSpacing: 2 }}>
              ● LIVE AI ENGINE
            </Text>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 6 }}>
              Advanced Signal
            </Text>
            <Text style={{ color: colors.text.secondary, fontSize: 13, marginTop: 4 }}>
              Triple-confirmation AI with 15+ indicators
            </Text>
          </View>
        </View>

        <Text style={styles.section}>INDEX</Text>
        <View style={{ flexDirection: 'row', marginBottom: spacing.sm }}>
          {INDICES.map((i) => (
            <Chip key={i} label={i} active={index === i} onPress={() => setIndex(i)} testID={`strategy-index-${i.toLowerCase()}`} />
          ))}
        </View>

        <Text style={styles.section}>INTERVAL</Text>
        <View style={{ flexDirection: 'row', marginBottom: spacing.base }}>
          {INTERVALS.map((iv) => (
            <Chip key={iv} label={`${iv}m`} active={interval === iv} onPress={() => setInterval(iv)} testID={`strategy-interval-${iv}`} />
          ))}
        </View>

        <Button
          testID="generate-signal-button"
          title="Generate AI Signal"
          onPress={fetchSignal}
          loading={loading}
          style={{ marginBottom: spacing.base }}
        />

{signal && (
          <Card testID="strategy-ai-signal-card" style={{ ...styles.signalCard, borderColor: signal.action?.includes('BUY') ? colors.trading.profit : colors.trading.loss }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{
                color: signal.action?.includes('BUY') ? colors.trading.profit : colors.trading.loss,
                fontSize: 22, fontWeight: '800', letterSpacing: -0.5,
              }}>
                {signal.action || 'HOLD'}
              </Text>
              <View style={styles.confidence}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>CONFIDENCE</Text>
                <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>{signal.confidence || 0}%</Text>
              </View>
            </View>

            <View style={styles.row}>
              <Metric label="ENTRY" value={`₹${signal.entryPrice || 0}`} color={colors.text.primary} />
              <Metric label="TARGET" value={`₹${signal.targetPrice || 0}`} color={colors.trading.profit} />
              <Metric label="STOP LOSS" value={`₹${signal.stopLossPrice || 0}`} color={colors.trading.loss} />
            </View>

            {signal.reasoning && (
              <View style={styles.reasoning}>
                <Text style={{ color: colors.text.secondary, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>REASONING</Text>
                <Text style={{ color: colors.text.primary, fontSize: 13, lineHeight: 18 }}>{signal.reasoning}</Text>
              </View>
            )}

            {signal.indicators && (
              <View style={{ marginTop: spacing.base }}>
                <Text style={{ color: colors.text.secondary, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>INDICATORS</Text>
                {Object.entries(signal.indicators).map(([k, v]) => (
                  <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                    <Text style={{ color: colors.text.secondary, fontSize: 12 }}>{k}</Text>
                    <Text style={{ color: colors.text.primary, fontSize: 12, fontWeight: '600' }}>{String(v)}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: colors.text.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>{label}</Text>
      <Text style={{ color, fontSize: 14, fontWeight: '700', marginTop: 4 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  hero: { borderRadius: radius.lg, overflow: 'hidden', height: 140, marginBottom: spacing.base },
  heroBg: { position: 'absolute', width: '100%', height: '100%', opacity: 0.6 },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,5,5,0.6)',
  },
  section: { ...(typography.caption as any), color: colors.text.secondary, marginTop: spacing.sm, marginBottom: spacing.sm },
  signalCard: {
    borderWidth: 2,
    borderRadius: radius.lg,
    shadowColor: colors.trading.profit,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  confidence: {
    backgroundColor: colors.bg.tertiary,
    padding: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
    minWidth: 90,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.base,
    marginTop: spacing.base,
    paddingTop: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  reasoning: {
    marginTop: spacing.base,
    paddingTop: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
});
