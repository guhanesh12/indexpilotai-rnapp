/**
 * Trailing Stop-Loss Card — Home screen
 *
 * Renders one card per active position where `raw_position.trailingEnabled === true`.
 * Placed directly under the existing P&L / positions block.
 *
 * Data source: GET {SERVER_URL}/position-monitor/list
 * Poll every 2–3 seconds while the screen is focused.
 */
import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { colors, spacing, radius } from '../lib/theme';

// ─── Types ─────────────────────────────────────────────
export interface TrailingPosition {
  id?: string;
  order_id?: string;
  orderId?: string;
  symbol?: string;
  trading_symbol?: string;
  index_name?: string;
  entry_price?: number;
  current_price?: number;
  quantity?: number;
  pnl?: number;
  highest_pnl?: number;
  target_amount?: number;
  stop_loss_amount?: number;
  trailing_enabled?: boolean;
  trailing_step?: number;
  raw_position?: {
    trailingEnabled?: boolean;
    trailingActive?: boolean;
    trailingActivationAmount?: number;
    targetJumpAmount?: number;
    stopLossJumpAmount?: number;
    trailingStepCount?: number;
    trailingActivatedAt?: number;
    baseTargetAmount?: number;
    baseStopLossAmount?: number;
    currentTargetAmount?: number;
    currentStopLossAmount?: number;
    profitLocked?: boolean;
  };
}

// ─── Helpers ───────────────────────────────────────────
function fmtINR(n: number): string {
  return `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function fmtINR2(n: number): string {
  return `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

// ─── Main Component ────────────────────────────────────
export default function TrailingStopLossCard({ position }: { position: TrailingPosition; key?: string | number }) {
  const raw = position.raw_position || {};
  const trailingActive = !!raw.trailingActive;
  const stepCount = Number(raw.trailingStepCount || 0);
  const activation = Number(raw.trailingActivationAmount || 0);
  const targetJump = Number(raw.targetJumpAmount || 0);
  const slJump = Number(raw.stopLossJumpAmount || 0);
  const baseTarget = Number(raw.baseTargetAmount || position.target_amount || 0);
  const baseSL = Number(raw.baseStopLossAmount || position.stop_loss_amount || 0);
  const currentTarget = Number(raw.currentTargetAmount || baseTarget);
  const currentSL = Number(raw.currentStopLossAmount || baseSL);
  const profitLocked = !!raw.profitLocked;
  const highestPnl = Number(position.highest_pnl || position.pnl || 0);
  const symbol = position.symbol || position.trading_symbol || 'Position';

  // ── Animations ──────────────────────────────────────
  // Fade + slide in the first time trailingActive flips to true
  const cardOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(24);
  const prevActiveRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (trailingActive && prevActiveRef.current === false) {
      // First time it becomes active — animate in
      cardOpacity.value = withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) })
      );
      cardTranslateY.value = withSequence(
        withTiming(24, { duration: 0 }),
        withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) })
      );
    } else if (prevActiveRef.current === null) {
      // Initial mount — just show
      cardOpacity.value = 1;
      cardTranslateY.value = 0;
    }
    prevActiveRef.current = trailingActive;
  }, [trailingActive]);

  // Pulse badge on trailingStepCount change
  const badgeScale = useSharedValue(1);
  const prevStepRef = useRef<number>(0);

  useEffect(() => {
    if (stepCount > prevStepRef.current) {
      badgeScale.value = withSequence(
        withTiming(1.25, { duration: 200 }),
        withTiming(1, { duration: 200 })
      );
    }
    prevStepRef.current = stepCount;
  }, [stepCount]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslateY.value }],
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }));

  // ── Render ──────────────────────────────────────────
  return (
    <Animated.View style={[styles.wrap, cardStyle]}>
      <LinearGradient
        colors={trailingActive ? ['#3D2B00', '#1A1200'] : ['#1A1A22', '#0F0F13']}
        style={[styles.card, trailingActive && styles.cardActive]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerIcon}>⚡</Text>
            <Text style={styles.headerTitle}>TRAILING STOP-LOSS</Text>
          </View>
          <Animated.View
            style={[
              styles.badge,
              trailingActive ? styles.badgeActive : styles.badgeWaiting,
              badgeStyle,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: trailingActive ? '#FFB800' : '#8A8A93' },
              ]}
            >
              {trailingActive
                ? `ACTIVE · STEP ${stepCount}`
                : `Waiting · activates at ${fmtINR(activation)}`}
            </Text>
          </Animated.View>
        </View>

        {/* Symbol */}
        <Text style={styles.symbol} numberOfLines={1}>
          {symbol}
        </Text>

        {/* 4 stat tiles */}
        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>ACTIVATION</Text>
            <Text style={styles.statValue}>{fmtINR(activation)}</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>TRAIL STEP</Text>
            <Text style={styles.statValue}>{fmtINR(slJump)}</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>TARGET STEP</Text>
            <Text style={styles.statValue}>{fmtINR(targetJump)}</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>STEPS DONE</Text>
            <Text style={[styles.statValue, { color: '#FFB800' }]}>{stepCount}</Text>
          </View>
        </View>

        {/* Comparison tiles: Target & Stop-Loss */}
        <View style={styles.compareRow}>
          {/* Target */}
          <View style={styles.compareTile}>
            <Text style={styles.compareLabel}>🎯 TARGET</Text>
            <View style={styles.compareValues}>
              {baseTarget !== currentTarget && (
                <Text style={styles.baseStruck}>{fmtINR(baseTarget)}</Text>
              )}
              <Text style={[styles.currentValue, { color: '#00FF66' }]}>
                {fmtINR(currentTarget)}
              </Text>
            </View>
          </View>

          {/* Stop-Loss */}
          <View style={styles.compareTile}>
            <Text style={styles.compareLabel}>🛡 STOP-LOSS</Text>
            <View style={styles.compareValues}>
              {baseSL !== currentSL && (
                <Text style={styles.baseStruck}>{fmtINR(baseSL)}</Text>
              )}
              {profitLocked ? (
                <Text style={[styles.currentValue, { color: '#00FF66' }]}>
                  Locked +{fmtINR(Math.abs(currentSL))}
                </Text>
              ) : (
                <Text style={[styles.currentValue, { color: '#FF3344' }]}>
                  {fmtINR(currentSL)}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Footer helper line */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {trailingActive
              ? `Every ${fmtINR(targetJump)} of extra profit moves Target +${fmtINR(targetJump)} and SL +${fmtINR(slJump)}.`
              : `Trailing starts once peak profit reaches ${fmtINR(activation)} (peak now ${fmtINR2(highestPnl)}).`}
          </Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

// ─── Styles ────────────────────────────────────────────
const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.base,
  },
  card: {
    borderRadius: radius.lg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  cardActive: {
    borderColor: 'rgba(255,184,0,0.4)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  headerIcon: {
    fontSize: 16,
  },
  headerTitle: {
    color: '#FFB800',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    flexShrink: 1,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    marginLeft: 8,
  },
  badgeActive: {
    backgroundColor: 'rgba(255,184,0,0.15)',
    borderColor: 'rgba(255,184,0,0.4)',
  },
  badgeWaiting: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  symbol: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statTile: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statLabel: {
    color: colors.text.disabled,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  statValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
  compareRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  compareTile: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  compareLabel: {
    color: colors.text.secondary,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  compareValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  baseStruck: {
    color: colors.text.disabled,
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'line-through',
  },
  currentValue: {
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  footer: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: radius.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  footerText: {
    color: colors.text.secondary,
    fontSize: 10,
    lineHeight: 14,
  },
});