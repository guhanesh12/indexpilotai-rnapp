import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../../lib/theme';

// ─── Types ────────────────────────────────────────
interface PositionSummaryData {
  totalCount: number;
  runningCount: number;
  closedCount: number;
  totalPnl: number;
  runningPnl: number;
  closedPnl: number;
  isEngineRunning?: boolean;
  runtime?: string;
}

interface PositionSummaryHeaderProps {
  data: PositionSummaryData;
  testID?: string;
}

// ─── Component (Compact version) ─────────────────
export default function PositionSummaryHeader({ data, testID }: PositionSummaryHeaderProps) {
  const {
    totalCount = 0,
    runningCount = 0,
    closedCount = 0,
    totalPnl = 0,
    runningPnl = 0,
    closedPnl = 0,
    isEngineRunning = false,
    runtime = 'N/A',
  } = data;

  const totalPositive = totalPnl >= 0;
  const runningPositive = runningPnl >= 0;

  return (
    <View testID={testID} style={styles.container}>
      {/* Top Row: Total P&L big + Running/Closed counts */}
      <View style={styles.topRow}>
        {/* Left side - compact Total P&L */}
        <View style={styles.totalPnlSection}>
          <Text style={styles.totalPnlLabel}>TOTAL P&L</Text>
          <View style={styles.totalPnlRow}>
            <Ionicons
              name={totalPositive ? 'trending-up' : 'trending-down'}
              size={16}
              color={totalPositive ? '#00FF66' : '#FF3344'}
            />
            <Text style={[styles.totalPnlValue, { color: totalPositive ? '#00FF66' : '#FF3344' }]}>
              {totalPositive ? '+' : ''}₹{Math.abs(totalPnl).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        {/* Right side - compact Running / Closed / Total */}
        <View style={styles.countsSection}>
          <View style={styles.countItem}>
            <View style={[styles.countDot, { backgroundColor: '#00FF66' }]} />
            <Text style={styles.countValue}>{runningCount}</Text>
            <Text style={styles.countLabel}>Run</Text>
          </View>
          <View style={styles.countDivider} />
          <View style={styles.countItem}>
            <View style={[styles.countDot, { backgroundColor: '#FFB800' }]} />
            <Text style={styles.countValue}>{closedCount}</Text>
            <Text style={styles.countLabel}>Closed</Text>
          </View>
          <View style={styles.countDivider} />
          <View style={styles.countItem}>
            <View style={[styles.countDot, { backgroundColor: '#B49AFF' }]} />
            <Text style={styles.countValue}>{totalCount}</Text>
            <Text style={styles.countLabel}>Total</Text>
          </View>
        </View>
      </View>

      {/* Bottom Row: Running P&L + Engine status */}
      <View style={styles.bottomRow}>
        <View style={styles.runningPnlBox}>
          <Text style={styles.runningPnlLabel}>RUNNING P&L</Text>
          <Text style={[styles.runningPnlValue, { color: runningPositive ? '#00FF66' : '#FF3344' }]}>
            {runningPositive ? '+' : ''}₹{Math.abs(runningPnl).toFixed(2)}
          </Text>
        </View>
        <View style={styles.engineBox}>
          <View style={[styles.engineDot, { backgroundColor: isEngineRunning ? '#00FF66' : '#FF3344' }]} />
          <Text style={styles.engineText}>
            {isEngineRunning ? 'ACTIVE' : 'STOP'}
          </Text>
          {isEngineRunning && <Text style={styles.engineRuntime}>{runtime}</Text>}
        </View>
      </View>
    </View>
  );
}

// ─── Styles (Compact) ────────────────────────────
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#16161A',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalPnlSection: {
    flex: 1,
  },
  totalPnlLabel: {
    color: colors.text.disabled,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  totalPnlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  totalPnlValue: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  countsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  countItem: {
    alignItems: 'center',
    minWidth: 36,
  },
  countDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 2,
  },
  countValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  countLabel: {
    color: colors.text.disabled,
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  countDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  runningPnlBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  runningPnlLabel: {
    color: colors.text.disabled,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  runningPnlValue: {
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  engineBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  engineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  engineText: {
    color: colors.text.secondary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  engineRuntime: {
    color: colors.text.disabled,
    fontSize: 8,
    fontWeight: '600',
    marginLeft: 2,
  },
});
