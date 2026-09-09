import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius, typography } from '../../lib/theme';

// ─── Types ────────────────────────────────────────
export interface PositionItem {
  order_id: string;
  security_id: string;
  trading_symbol: string;
  exchange_segment: string;
  transaction_type: 'BUY' | 'SELL';
  quantity: number;
  entry_price: number;
  current_price: number;
  target_amount: number;
  stop_loss_amount: number;
  unrealized_pnl: number;
  is_active: boolean;
  trailing_enabled: boolean;
  trailing_step: number;
  is_closed?: boolean;
  exit_price?: number;
  realized_pnl?: number;
  exit_time?: string;
  raw_position?: any;
}

// ─── Constants ────────────────────────────────────
const PROFIT_COLOR = '#00FF66';
const LOSS_COLOR = '#FF3344';
const WARNING_COLOR = '#FFB800';
const TRAIL_COLOR = '#B49AFF';

// ─── Component ────────────────────────────────────
interface PositionCardProps {
  item: PositionItem;
  onExit: (item: PositionItem) => Promise<void>;
  onTrailingToggle: (item: PositionItem) => Promise<void>;
  isExiting?: boolean;
  variant?: 'default' | 'compact' | 'advanced';
  isSelected?: boolean;
  onSelect?: (item: PositionItem) => void;
  selectionMode?: boolean;
}

export default function PositionCard({
  item,
  onExit,
  onTrailingToggle,
  isExiting = false,
  variant = 'default',
  isSelected = false,
  onSelect,
  selectionMode = false,
}: PositionCardProps) {
  const pnl = item.unrealized_pnl || 0;
  const realizedPnl = item.realized_pnl || 0;
  const isClosed = item.is_closed || !item.is_active;
  // For closed positions, display realized P&L; for running, display unrealized
  const displayPnl = isClosed && realizedPnl ? realizedPnl : pnl;
  const positive = displayPnl >= 0;

  // ── Animations ──
  const cardScale = useSharedValue(1);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  // ── Handlers ──
  const handlePressIn = () => {
    cardScale.value = withSpring(0.98, { damping: 20, stiffness: 300 });
  };

  const handlePressOut = () => {
    cardScale.value = withSpring(1, { damping: 20, stiffness: 300 });
  };

  // ── Render variants ──
  if (variant === 'compact') {
    return (
      <Animated.View style={[cardAnimatedStyle]}>
        <TouchableOpacity
          activeOpacity={0.95}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={[styles.compactCard, isClosed && styles.closedCard]}
        >
          <View style={styles.compactRow}>
            {/* Status dot */}
            <View style={[styles.statusDot, { backgroundColor: isClosed ? colors.text.disabled : (positive ? PROFIT_COLOR : LOSS_COLOR) }]} />
            
            {/* Symbol + Qty */}
            <View style={{ flex: 1 }}>
              <Text style={styles.compactSymbol} numberOfLines={1}>{item.trading_symbol}</Text>
              <Text style={styles.compactQty}>{item.quantity} shares</Text>
            </View>

            {/* P&L */}
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.compactPnl, { color: isClosed ? colors.text.disabled : (positive ? PROFIT_COLOR : LOSS_COLOR) }]}>
                {isClosed ? '' : (positive ? '+' : '')}₹{Math.abs(isClosed ? realizedPnl : pnl).toFixed(2)}
              </Text>
              <Text style={styles.compactType}>{isClosed ? 'Closed' : (item.transaction_type === 'BUY' ? 'Long' : 'Short')}</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // ── Default / Advanced variant ──
  return (
    <Animated.View style={[cardAnimatedStyle]}>
      <TouchableOpacity
        activeOpacity={0.95}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <LinearGradient
          colors={isClosed ? ['#1A1A22', '#111118'] : (isSelected ? ['#2A1F4A', '#1A1535'] : ['#16161A', '#121218'])}
          style={[
            styles.card,
            isClosed && styles.closedCard,
            isSelected && !isClosed && styles.selectedCard,
          ]}
        >
          {/* CLOSED Header Badge - appears at top of card */}
          {isClosed && (
            <View style={styles.closedHeader}>
              <View style={styles.closedHeaderBadge}>
                <Ionicons name="lock-closed" size={12} color="#FFB800" />
                <Text style={styles.closedHeaderText}>CLOSED</Text>
              </View>
            </View>
          )}

          {/* Header: Selection checkbox + Symbol + P&L Badge */}
          <View style={styles.cardHeader}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              {/* Selection Checkbox */}
              {selectionMode && !isClosed && (
                <TouchableOpacity
                  onPress={() => onSelect?.(item)}
                  style={styles.selectCheckBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={isSelected ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={isSelected ? '#7C5CFF' : colors.text.disabled}
                  />
                </TouchableOpacity>
              )}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[styles.statusDotLarge, { backgroundColor: isClosed ? colors.text.disabled : (positive ? PROFIT_COLOR : LOSS_COLOR) }]} />
                  <Text style={styles.symbol}>{item.trading_symbol}</Text>
                  {!isClosed && (
                    <View style={styles.runningBadge}><Text style={styles.runningBadgeText}>RUNNING</Text></View>
                  )}
                </View>
                <Text style={styles.qty}>
                  {item.quantity} shares • {item.transaction_type === 'BUY' ? 'Long' : 'Short'} @ ₹{item.entry_price}
                </Text>
              </View>
            </View>
            <View style={[styles.pnlBadge, { backgroundColor: (positive ? '#00FF6622' : '#FF334422') }]}>
              <Text style={[styles.pnlText, { color: positive ? PROFIT_COLOR : LOSS_COLOR }]}>
                {(positive ? '+' : '') + '₹' + Math.abs(displayPnl).toFixed(2)}
              </Text>
              <Text style={styles.pnlLabel}>
                {isClosed ? (realizedPnl ? 'Realized' : 'Closed') : 'Unrealized'}
              </Text>
            </View>
          </View>

          {/* Price Row: Entry → Current → Target → SL */}
          <View style={styles.priceRow}>
            <PriceItem label="ENTRY" value={`₹${item.entry_price}`} color="#fff" />
            <Ionicons name="arrow-forward" size={14} color={colors.text.disabled} />
            <PriceItem label="CURRENT" value={`₹${item.current_price}`} color={positive ? PROFIT_COLOR : LOSS_COLOR} />
            {!isClosed && (
              <>
                <PriceItem label="TARGET" value={`₹${item.target_amount}`} color={PROFIT_COLOR} />
                <PriceItem label="SL" value={`₹${item.stop_loss_amount}`} color={LOSS_COLOR} />
              </>
            )}
          </View>

          {/* Chips */}
          {!isClosed && (
            <View style={styles.chipRow}>
              {item.target_amount > 0 && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>T: ₹{item.target_amount}</Text>
                </View>
              )}
              {item.stop_loss_amount > 0 && (
                <View style={[styles.chip, { borderColor: '#FF334488' }]}>
                  <Text style={[styles.chipText, { color: LOSS_COLOR }]}>SL: ₹{item.stop_loss_amount}</Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.chip, item.trailing_enabled && styles.chipActive]}
                onPress={() => onTrailingToggle(item)}
              >
                <Ionicons
                  name={item.trailing_enabled ? 'checkbox' : 'square-outline'}
                  size={14}
                  color={item.trailing_enabled ? WARNING_COLOR : colors.text.disabled}
                />
                <Text style={[styles.chipText, item.trailing_enabled && { color: WARNING_COLOR }]}>
                  Trail {item.trailing_enabled && `${item.trailing_step}%`}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Exit Time for closed positions */}
          {isClosed && item.exit_time && (
            <View style={styles.exitTimeRow}>
              <Ionicons name="time-outline" size={14} color={colors.text.disabled} />
              <Text style={styles.exitTimeText}>Exited: {item.exit_time}</Text>
            </View>
          )}

          {/* Exit button removed - use "Exit Selected" or "Close All" from parent screen */}
          {!isClosed && (
            <View style={styles.exitActionHint}>
              <Ionicons name="checkmark-circle-outline" size={14} color="#7C5CFF" />
              <Text style={styles.exitActionHintText}>Select & exit via bottom buttons</Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Sub-components ────────────────────────────────
function PriceItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.priceItem}>
      <Text style={styles.priceLabel}>{label}</Text>
      <Text style={[styles.priceValue, { color }]}>{value}</Text>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────
const styles = StyleSheet.create({
  // Default Card
  card: {
    borderRadius: radius.lg,
    padding: spacing.base,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  closedCard: {
    opacity: 0.7,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  selectedCard: {
    borderColor: '#7C5CFF',
    borderWidth: 1.5,
  },
  selectCheckBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -2,
  },
  glowOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusDotLarge: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  symbol: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  qty: {
    color: colors.text.secondary,
    fontSize: 12,
    marginTop: 2,
    marginLeft: 18,
  },
  pnlBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.sm,
    alignItems: 'center',
    minWidth: 80,
  },
  pnlText: {
    fontSize: 15,
    fontWeight: '800',
  },
  pnlLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.text.disabled,
    marginTop: 1,
  },
  closedHeader: {
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,184,0,0.15)',
  },
  closedHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,184,0,0.12)',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.3)',
  },
  closedHeaderText: {
    color: '#FFB800',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  closedBadge: {
    backgroundColor: 'rgba(255,184,0,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.3)',
  },
  closedBadgeText: {
    color: '#FFB800',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  runningBadge: {
    backgroundColor: 'rgba(0,255,102,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,255,102,0.2)',
  },
  runningBadgeText: {
    color: '#00FF66',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  priceItem: {
    alignItems: 'center',
    flex: 1,
  },
  priceLabel: {
    color: colors.text.disabled,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  priceValue: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.primary,
  },
  chipActive: {
    borderColor: '#FFB80088',
    backgroundColor: '#FFB80022',
  },
  chipText: {
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '600',
  },
  exitTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  exitTimeText: {
    color: colors.text.disabled,
    fontSize: 11,
  },
  exitActionHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  exitActionHintText: {
    color: '#7C5CFF',
    fontSize: 11,
    fontWeight: '600',
  },

  // Compact Card
  compactCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  compactSymbol: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  compactQty: {
    color: colors.text.secondary,
    fontSize: 10,
    marginTop: 1,
  },
  compactPnl: {
    fontSize: 14,
    fontWeight: '800',
  },
  compactType: {
    color: colors.text.disabled,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 1,
  },
});
