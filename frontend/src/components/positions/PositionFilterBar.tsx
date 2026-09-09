import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { colors, spacing, radius } from '../../lib/theme';

// ─── Types ────────────────────────────────────────
export type PositionFilter = 'running' | 'closed' | 'all';

interface PositionFilterBarProps {
  activeFilter: PositionFilter;
  onFilterChange: (filter: PositionFilter) => void;
  runningCount?: number;
  closedCount?: number;
  allCount?: number;
}

// ─── Constants ────────────────────────────────────
const FILTERS: { key: PositionFilter; label: string }[] = [
  { key: 'running', label: 'Running' },
  { key: 'closed', label: 'Closed' },
  { key: 'all', label: 'All' },
];

// ─── Component ────────────────────────────────────
export default function PositionFilterBar({
  activeFilter,
  onFilterChange,
  runningCount = 0,
  closedCount = 0,
  allCount = 0,
}: PositionFilterBarProps) {
  const indicatorPosition = useSharedValue(0);

  const getCount = (filter: PositionFilter) => {
    switch (filter) {
      case 'running': return runningCount;
      case 'closed': return closedCount;
      case 'all': return allCount;
    }
  };

  useEffect(() => {
    const index = FILTERS.findIndex((f) => f.key === activeFilter);
    indicatorPosition.value = withSpring(index * (100 / FILTERS.length) + (50 / FILTERS.length), {
      damping: 20,
      stiffness: 200,
    });
  }, [activeFilter]);

  const indicatorStyle = useAnimatedStyle(() => ({
    left: `${indicatorPosition.value - 4}%`,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {FILTERS.map((filter) => {
          const isActive = activeFilter === filter.key;
          const count = getCount(filter.key);
          return (
            <TouchableOpacity
              key={filter.key}
              onPress={() => onFilterChange(filter.key)}
              style={[styles.filterBtn, isActive && styles.filterBtnActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterLabel, isActive && styles.filterLabelActive]}>
                {filter.label}
              </Text>
              <View style={[styles.countBadge, isActive && styles.countBadgeActive]}>
                <Text style={[styles.countText, isActive && styles.countTextActive]}>
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Animated indicator bar */}
      <Animated.View style={[styles.indicator, indicatorStyle]} />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.base,
    position: 'relative',
  },
  filterRow: {
    flexDirection: 'row',
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  filterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radius.md - 2,
  },
  filterBtnActive: {
    backgroundColor: 'rgba(124,92,255,0.15)',
  },
  filterLabel: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '700',
  },
  filterLabelActive: {
    color: '#B49AFF',
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  countBadgeActive: {
    backgroundColor: 'rgba(124,92,255,0.3)',
  },
  countText: {
    color: colors.text.disabled,
    fontSize: 11,
    fontWeight: '700',
  },
  countTextActive: {
    color: '#B49AFF',
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    width: '16%',
    height: 3,
    backgroundColor: '#7C5CFF',
    borderRadius: 2,
  },
});
