import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  Modal,
  Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSpring,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Heading, Body } from '../../src/components/Primitives';
import { colors, spacing, typography, radius } from '../../src/lib/theme';
import { positionMonitorApi as pmApi, api } from '../../src/lib/api';
import PositionCard, { PositionItem } from '../../src/components/positions/PositionCard';
import PositionSummaryHeader from '../../src/components/positions/PositionSummaryHeader';
import PositionFilterBar, { PositionFilter } from '../../src/components/positions/PositionFilterBar';
import ImageAvailableModule from '../../src/components/positions/ImageAvailableModule';
import PnlScreenshotCard from '../../src/components/PnlScreenshotCard';

// ─── Mapper from API /positions to PositionItem (same as position-monitor.tsx) ───
function calcPnlFromPrices(entry: number, current: number, qty: number, side: string): number {
  if (!entry || !current || !qty) return 0;
  const diff = current - entry;
  return side === 'SELL' ? -(diff * qty) : (diff * qty);
}

function mapApiPositionToPositionItem(src: any): PositionItem | null {
  if (!src) return null;
  const orderId = src.order_id || src.orderId || src.id || src.positionId || `pos_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const secId = src.security_id || src.securityId || src.symbol_id || src.instrumentToken || '';
  const symbol = src.trading_symbol || src.tradingSymbol || src.symbol || src.name || 'Unknown';
  const exchange = src.exchange_segment || src.exchangeSegment || src.exchange || 'NSE_FNO';
  const qty = Math.max(0, Number(src.quantity || src.qty || src.lot_size || 0));
  const entryPrice = Number(src.entry_price || src.entryPrice || src.avgPrice || src.average_price || 0);
  const currentPrice = Number(src.current_price || src.currentPrice || src.ltp || src.lastPrice || src.market_price || entryPrice);
  const target = Number(src.target_amount || src.targetAmount || src.target || 0);
  const stopLoss = Number(src.stop_loss_amount || src.stopLossAmount || src.stop_loss || src.stopLoss || 0);
  const transactionType = (src.transaction_type || src.transactionType || src.side || src.action || 'BUY').toUpperCase();
  
  // P&L: try all possible field names from API, fallback to calculation
  let unrealizedPnl = Number(src.unrealized_pnl || src.unrealizedPnl || src.pnl || src.profitLoss || src.profit_loss || src.pnl_amount || src.PnL || 0);
  if (unrealizedPnl === 0 && entryPrice > 0 && currentPrice > 0 && qty > 0) {
    unrealizedPnl = calcPnlFromPrices(entryPrice, currentPrice, qty, transactionType);
  }
  
  let realizedPnl = Number(src.realized_pnl || src.realizedPnl || src.realizedPnL || src.closedPnl || 0);
  
  const isActive = src.is_active !== undefined ? !!src.is_active : (src.status === 'active' || src.status === 'running' || !src.status);
  const isClosed = src.is_closed !== undefined ? !!src.is_closed : (src.status === 'closed' || src.status === 'exited');
  
  const trailingEnabled = src.trailing_enabled !== undefined ? !!src.trailing_enabled : !!src.trailingEnabled;
  const trailingStep = Number(src.trailing_step || src.trailingStep || 0.5);
  const exitPrice = Number(src.exit_price || src.exitPrice || 0);
  const exitTime = src.exit_time || src.exitTime || src.exited_at || '';

  return {
    order_id: orderId,
    security_id: secId,
    trading_symbol: symbol,
    exchange_segment: exchange,
    transaction_type: transactionType === 'SELL' ? 'SELL' : 'BUY',
    quantity: qty,
    entry_price: entryPrice,
    current_price: currentPrice,
    target_amount: target,
    stop_loss_amount: stopLoss,
    unrealized_pnl: unrealizedPnl,
    is_active: isActive && !isClosed,
    trailing_enabled: trailingEnabled,
    trailing_step: trailingStep,
    is_closed: isClosed || !isActive,
    exit_price: exitPrice || undefined,
    realized_pnl: realizedPnl || undefined,
    exit_time: exitTime || undefined,
    raw_position: src,
  };
}

function extractPositionsFromResponse(res: any): PositionItem[] {
  if (!res) return [];
  const rawList = res.positions || res.data || res.livePositions || res.activePositions || res.monitor || res.results || (Array.isArray(res) ? res : []);
  const list = Array.isArray(rawList) ? rawList : [];
  return list.map(mapApiPositionToPositionItem).filter(Boolean) as PositionItem[];
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Helpers ───────────────────────────────────────
function formatDuration(ms: number) {
  if (ms <= 0) return 'N/A';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

function calculateSummary(positions: PositionItem[]) {
  const running = positions.filter((p) => p.is_active && !p.is_closed);
  const closed = positions.filter((p) => !p.is_active || p.is_closed);
  return {
    totalCount: positions.length,
    runningCount: running.length,
    closedCount: closed.length,
    totalPnl: positions.reduce((sum, p) => sum + (p.unrealized_pnl || p.realized_pnl || 0), 0),
    runningPnl: running.reduce((sum, p) => sum + (p.unrealized_pnl || 0), 0),
    closedPnl: closed.reduce((sum, p) => sum + (p.realized_pnl || 0), 0),
  };
}

// ─── Execute a single exit order ───────────────────
async function executeExit(pos: PositionItem): Promise<{ success: boolean; symbol: string; orderId?: string; error?: string }> {
  try {
    const result = await pmApi.exitPosition({
      order_id: pos.order_id,
      symbol_id: pos.security_id,
      security_id: pos.security_id,
      exchange_segment: pos.exchange_segment || 'NSE_FNO',
      quantity: pos.quantity,
      trading_symbol: pos.trading_symbol,
      symbol: pos.trading_symbol,
      index_name: (pos as any).index_name || '',
    });
    if (result?.success || result?.orderId) {
      return { success: true, symbol: pos.trading_symbol, orderId: result.orderId };
    }
    return { success: false, symbol: pos.trading_symbol, error: result?.message || 'Exit failed' };
  } catch (err: any) {
    return { success: false, symbol: pos.trading_symbol, error: err.message };
  }
}

// ─── Animated Header ───────────────────────────────
function AnimatedHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const glowScale = useSharedValue(0.95);
  useEffect(() => {
    glowScale.value = withRepeat(
      withTiming(1.05, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, []);
  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
    opacity: 0.3 + (glowScale.value - 0.95) * 5,
  }));
  return (
    <View style={advStyles.animatedHeader}>
      <Animated.View style={[advStyles.headerGlow, glowStyle]}>
        <LinearGradient
          colors={['#7C5CFF', '#FF4DD2', '#00B4FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Text style={advStyles.headerTitle}>{title}</Text>
      <Text style={advStyles.headerSubtitle}>{subtitle}</Text>
    </View>
  );
}

// ─── Advanced Analytics Card ───────────────────────
function AnalyticsCard({ positions, engineRunning, runtime }: {
  positions: PositionItem[];
  engineRunning: boolean;
  runtime: string;
}) {
  const running = positions.filter((p) => p.is_active && !p.is_closed);
  const totalValue = positions.reduce((sum, p) => sum + p.quantity * p.current_price, 0);
  const avgPnlPerPos = positions.length > 0
    ? positions.reduce((sum, p) => sum + (p.unrealized_pnl || p.realized_pnl || 0), 0) / positions.length
    : 0;

  const analytics = [
    { label: 'Total Value', value: `₹${totalValue.toLocaleString('en-IN')}`, color: '#B49AFF' },
    { label: 'Avg P&L/Pos', value: `${avgPnlPerPos >= 0 ? '+' : ''}₹${Math.abs(avgPnlPerPos).toFixed(2)}`, color: avgPnlPerPos >= 0 ? '#00FF66' : '#FF3344' },
    { label: 'Win Rate', value: positions.length > 0 ? `${Math.round((positions.filter(p => (p.unrealized_pnl || 0) >= 0).length / positions.length) * 100)}%` : 'N/A', color: '#FFB800' },
    { label: 'Runtime', value: runtime, color: '#00B4FF' },
  ];

  return (
    <LinearGradient
      colors={['#1A1A2E', '#12121A']}
      style={advStyles.analyticsCard}
    >
      <Text style={advStyles.analyticsTitle}>ANALYTICS</Text>
      <View style={advStyles.analyticsGrid}>
        {analytics.map((item, idx) => (
          <View key={idx} style={advStyles.analyticsItem}>
            <Text style={advStyles.analyticsLabel}>{item.label}</Text>
            <Text style={[advStyles.analyticsValue, { color: item.color }]}>{item.value}</Text>
          </View>
        ))}
      </View>
    </LinearGradient>
  );
}

// ─── Main Screen ──────────────────────────────────
export default function AdvancedPositionsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [positions, setPositions] = useState<PositionItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<PositionFilter>('all');
  const [engineRunning, setEngineRunning] = useState(false);
  const [engineStartTime, setEngineStartTime] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Extended API data ──
  const [allPositions, setAllPositions] = useState<any[]>([]);
  const [marketData, setMarketData] = useState<any>(null);

  // ── Selection state (always ON for running positions) ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExitingSelected, setIsExitingSelected] = useState(false);
  const [isClosingAll, setIsClosingAll] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  
  // ── Screenshot/Portfolio snapshot state ──
  const [screenshotOpen, setScreenshotOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Load positions - USE SAME DATA SOURCE AS HOME SCREEN ──
  const loadAll = useCallback(async () => {
    try {
      // Use api.getLivePositions() directly - same as Home screen which shows P&L correctly
      const res: any = await api.getLivePositions();
      const list = res?.positions ?? res?.data ?? res?.livePositions ?? [];
      const arr = Array.isArray(list) ? list : [];
      
      console.log(`[AdvancedPositions] Raw positions from API: ${arr.length}`);
      
      if (arr.length > 0) {
        const mapped: PositionItem[] = arr.map((x: any, idx: number) => {
          const rawPnl = Number(x.pnl || x.profitLoss || x.profit_loss || x.unrealizedProfit || 0);
          const entryPrice = Number(x.entry_price || x.entryPrice || x.avgPrice || x.buyAvg || x.costPrice || 0);
          const currentPrice = Number(x.current_price || x.currentPrice || x.ltp || x.lastPrice || x.costPrice || x.sellAvg || entryPrice);
          const qty = Math.max(0, Number(x.quantity || x.qty || x.buyQty || x.sellQty || x.netQty || 0));
          const side = (x.transaction_type || x.transactionType || x.side || 'BUY').toUpperCase();
          
          let finalPnl = rawPnl;
          if (finalPnl === 0 && entryPrice > 0 && currentPrice > 0 && qty > 0) {
            const diff = currentPrice - entryPrice;
            finalPnl = side === 'SELL' ? -(diff * qty) : (diff * qty);
          }
          
          // Detect closed positions: netQty=0 means fully closed
          const netQty = Number(x.netQty || x.net_qty || 0);
          const isClosed = netQty === 0 || x.is_closed === true || x.status === 'closed' || x.status === 'exited';
          const isActive = !isClosed;
          
          // Use realizedProfit for closed positions
          const realizedPnl = Number(x.realizedProfit || x.realized_profit || x.realizedPnl || 0);
          const unrealizedPnl = isClosed ? 0 : finalPnl;
          
          return {
            order_id: x.order_id || x.orderId || x.id || x.positionId || `pos_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            security_id: x.security_id || x.securityId || x.symbol_id || '',
            trading_symbol: x.trading_symbol || x.tradingSymbol || x.symbol || x.name || 'Unknown',
            exchange_segment: x.exchange_segment || x.exchangeSegment || 'NSE_FNO',
            transaction_type: side === 'SELL' ? 'SELL' as const : 'BUY' as const,
            quantity: qty,
            entry_price: entryPrice,
            current_price: currentPrice,
            target_amount: Number(x.target_amount || x.targetAmount || 0),
            stop_loss_amount: Number(x.stop_loss_amount || x.stopLossAmount || 0),
            unrealized_pnl: unrealizedPnl,
            realized_pnl: realizedPnl,
            is_active: isActive,
            is_closed: isClosed,
            trailing_enabled: false,
            trailing_step: 0.5,
            raw_position: x,
          } as PositionItem;
        });
        
        console.log(`[AdvancedPositions] Mapped ${mapped.length} positions with P&L`);
        setPositions(mapped);
      }
    } catch (err: any) {
      console.warn('[AdvancedPositions] Load failed:', err.message);
      try {
        const backup: any = await api.getPositions();
        const backupList = backup?.positions ?? backup?.data ?? (Array.isArray(backup) ? backup : []);
        const arr2 = Array.isArray(backupList) ? backupList : [];
        if (arr2.length > 0) {
          const mapped: PositionItem[] = arr2.map((x: any) => ({
            order_id: x.order_id || x.orderId || x.id || `pos_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            security_id: x.security_id || x.securityId || '',
            trading_symbol: x.trading_symbol || x.tradingSymbol || x.symbol || 'Unknown',
            exchange_segment: x.exchange_segment || 'NSE_FNO',
            transaction_type: 'BUY' as const,
            quantity: Math.max(0, Number(x.quantity || x.qty || 0)),
            entry_price: Number(x.entry_price || x.entryPrice || 0),
            current_price: Number(x.current_price || x.currentPrice || x.ltp || 0),
            target_amount: Number(x.target_amount || 0),
            stop_loss_amount: Number(x.stop_loss_amount || 0),
            unrealized_pnl: Number(x.pnl || x.profitLoss || x.unrealized_pnl || 0),
            is_active: true,
            trailing_enabled: false,
            trailing_step: 0.5,
          } as PositionItem));
          setPositions(mapped);
        }
      } catch {}
    } finally {
      setLoading(false);
    }
  }, []);

  // ── 1-second polling ──
  useFocusEffect(
    useCallback(() => {
      loadAll();
      pollingRef.current = setInterval(loadAll, 1000);

      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      };
    }, [loadAll])
  );

  const handleTrailingToggle = async (item: PositionItem) => {
    try {
      await pmApi.updateTrailing({ orderId: item.order_id, trailingEnabled: !item.trailing_enabled, trailingStep: item.trailing_step || 0.5 });
      const result = await pmApi.getList();
      if (result?.success && result?.positions) setPositions(result.positions);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  // ── Filtered data ──
  const filteredPositions = React.useMemo(() => {
    switch (activeFilter) {
      case 'running': return positions.filter((p) => p.is_active && !p.is_closed);
      case 'closed': return positions.filter((p) => !p.is_active || p.is_closed);
      default: return positions;
    }
  }, [positions, activeFilter]);

  const summary = calculateSummary(positions);
  const runtime = engineRunning && engineStartTime ? formatDuration(Date.now() - engineStartTime) : 'N/A';

  const runningPositions = positions.filter((p) => p.is_active && !p.is_closed);

  // ── Selection handlers ──
  const toggleSelection = (item: PositionItem) => {
    if (item.is_closed || !item.is_active) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.order_id)) {
        next.delete(item.order_id);
      } else {
        next.add(item.order_id);
      }
      return next;
    });
  };

  const toggleSelectAllRunning = () => {
    const runningIds = runningPositions.map((p) => p.order_id);
    if (selectedIds.size === runningIds.length && runningIds.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(runningIds));
    }
  };

  // ── Exit Selected handler ──
  const handleExitSelected = async () => {
    const selectedPositions = positions.filter(
      (p) => selectedIds.has(p.order_id) && p.is_active && !p.is_closed
    );
    
    if (selectedPositions.length === 0) {
      Alert.alert('No Positions Selected', 'Please select at least one position to exit.');
      return;
    }

    Alert.alert(
      `Exit ${selectedPositions.length} Position${selectedPositions.length > 1 ? 's' : ''}?`,
      `This will place MARKET orders to close ${selectedPositions.length} selected position(s).`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'EXIT SELECTED',
          style: 'destructive',
          onPress: async () => {
            setIsExitingSelected(true);
            setBatchProgress({ current: 0, total: selectedPositions.length });

            let successful = 0;
            let failed = 0;
            const failedSymbols: string[] = [];

            for (let i = 0; i < selectedPositions.length; i++) {
              const pos = selectedPositions[i];
              setBatchProgress({ current: i + 1, total: selectedPositions.length });
              
              const result = await executeExit(pos);
              if (result.success) {
                successful++;
              } else {
                failed++;
                failedSymbols.push(pos.trading_symbol);
              }
            }

            setIsExitingSelected(false);
            setSelectedIds(new Set());

            if (failed === 0) {
              Alert.alert('✅ Exit Complete', `Successfully exited ${successful} selected position(s).`);
            } else {
              Alert.alert('⚠️ Exit Partial', `Successful: ${successful}\nFailed: ${failed}\n\nFailed symbols:\n${failedSymbols.join(', ')}`);
            }

            const refreshResult = await pmApi.getList();
            if (refreshResult?.success && refreshResult?.positions) {
              setPositions(refreshResult.positions);
            }
          },
        },
      ]
    );
  };

  // ── Close All Positions handler ──
  const handleCloseAll = async () => {
    const positionsToExit = positions.filter((p) => p.is_active && !p.is_closed);
    
    if (positionsToExit.length === 0) return;

    Alert.alert(
      `Close All (${positionsToExit.length}) Positions?`,
      `This will place MARKET orders to close ALL ${positionsToExit.length} running position(s).\n\nThis action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'CLOSE ALL',
          style: 'destructive',
          onPress: async () => {
            setIsClosingAll(true);
            setBatchProgress({ current: 0, total: positionsToExit.length });

            let successful = 0;
            let failed = 0;
            const failedSymbols: string[] = [];

            for (let i = 0; i < positionsToExit.length; i++) {
              const pos = positionsToExit[i];
              setBatchProgress({ current: i + 1, total: positionsToExit.length });
              
              const result = await executeExit(pos);
              if (result.success) {
                successful++;
              } else {
                failed++;
                failedSymbols.push(pos.trading_symbol);
              }
            }

            setIsClosingAll(false);
            setSelectedIds(new Set());

            if (failed === 0) {
              Alert.alert('✅ All Positions Closed', `Successfully closed all ${successful} position(s).`);
            } else {
              Alert.alert('⚠️ Close All Partial', `Successful: ${successful}\nFailed: ${failed}\n\nFailed symbols:\n${failedSymbols.join(', ')}`);
            }

            const refreshResult = await pmApi.getList();
            if (refreshResult?.success && refreshResult?.positions) {
              setPositions(refreshResult.positions);
            }
          },
        },
      ]
    );
  };

  // ── Render items ──
  const renderItem = ({ item }: { item: PositionItem }) => (
    <PositionCard
      item={item}
      onExit={async () => {}} // Individual exit removed - use bottom buttons
      onTrailingToggle={handleTrailingToggle}
      isExiting={false}
      variant="advanced"
      isSelected={selectedIds.has(item.order_id)}
      onSelect={toggleSelection}
      selectionMode={item.is_active && !item.is_closed}
    />
  );

  const renderEmpty = () => (
    <View style={advStyles.emptyContainer}>
      <Ionicons name="analytics-outline" size={64} color={colors.text.disabled} />
      <Text style={advStyles.emptyText}>
        {activeFilter === 'running' ? 'No running positions' : activeFilter === 'closed' ? 'No closed positions' : 'No positions'}
      </Text>
      <Text style={advStyles.emptySubtext}>Advanced analytics will appear when positions are active</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={advStyles.container} edges={['top']}>
        <View style={advStyles.loadingContainer}>
          <ActivityIndicator size="large" color="#7C5CFF" />
          <Text style={advStyles.loadingText}>Initializing Advanced Position Monitor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const hasRunningPositions = runningPositions.length > 0;
  const hasSelected = selectedIds.size > 0;

  return (
    <SafeAreaView style={advStyles.container} edges={['top']}>
      {/* Animated Header */}
      <AnimatedHeader
        title="Advanced Positions"
        subtitle="Real-time analytics & monitoring"
      />

      <ScrollView
        contentContainerStyle={{
          padding: spacing.base,
          paddingBottom: insets.bottom + (hasRunningPositions ? 180 : 100),
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary Hub */}
        <PositionSummaryHeader
          data={{ ...summary, isEngineRunning: engineRunning, runtime }}
        />

        {/* Analytics Card */}
        <AnalyticsCard positions={positions} engineRunning={engineRunning} runtime={runtime} />

        {/* Live Status Banner */}
        <LinearGradient colors={['#00FF6622', '#00B4A022']} style={advStyles.liveBanner}>
          <AnimatedLiveDot />
          <Text style={advStyles.liveBannerText}>
            Live • {filteredPositions.length} positions • 1s refresh
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={advStyles.switchBtn}
          >
            <Ionicons name="swap-horizontal" size={16} color="#00FF66" />
            <Text style={advStyles.switchBtnText}>Standard</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Filter Bar */}
        <PositionFilterBar
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          runningCount={summary.runningCount}
          closedCount={summary.closedCount}
          allCount={summary.totalCount}
        />

        {/* Select All Toolbar */}
        {hasRunningPositions && (
          <View style={advStyles.selectionToolbar}>
            <TouchableOpacity style={advStyles.selectAllBtn} onPress={toggleSelectAllRunning}>
              <Ionicons
                name={selectedIds.size === runningPositions.length && runningPositions.length > 0 ? 'checkbox' : 'square-outline'}
                size={20}
                color={selectedIds.size === runningPositions.length && runningPositions.length > 0 ? '#7C5CFF' : colors.text.disabled}
              />
              <Text style={advStyles.selectAllText}>
                {selectedIds.size === runningPositions.length && runningPositions.length > 0 ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>
            <Text style={advStyles.selectedCount}>
              {selectedIds.size} of {runningPositions.length} selected
            </Text>
          </View>
        )}

        {/* Position List */}
        {filteredPositions.length === 0 ? (
          renderEmpty()
        ) : (
          filteredPositions.map((item) => (
            <PositionCard
              key={item.order_id}
              item={item}
              onExit={async () => {}}
              onTrailingToggle={handleTrailingToggle}
              isExiting={false}
              variant="advanced"
              isSelected={selectedIds.has(item.order_id)}
              onSelect={toggleSelection}
              selectionMode={item.is_active && !item.is_closed}
            />
          ))
        )}

        {/* Image Available Module */}
        <ImageAvailableModule
          onViewAll={() => {
            setScreenshotOpen(true);
          }}
          onCaptureScreenshot={() => {
            setScreenshotOpen(true);
          }}
          onShareAll={() => {
            const pnlSign = summary.totalPnl >= 0 ? '+' : '';
            const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            const shareText = `📊 IndexPilot AI - Advanced Positions\n\n📅 ${dateStr}\n💰 P&L: ${pnlSign}₹${Math.abs(summary.totalPnl).toLocaleString('en-IN')}\n📂 Positions: ${positions.length}\n🏃 Running: ${summary.runningCount}\n✅ Closed: ${summary.closedCount}\n\n🤖 IndexPilot AI\n#IndexPilotAI`;
            Share.share({ message: shareText, title: 'IndexPilot AI - Advanced Positions' });
          }}
          onRefresh={() => {
            loadAll();
          }}
          onDownload={() => {
            setScreenshotOpen(true);
          }}
        />
      </ScrollView>

      {/* Portfolio Screenshot Modal */}
      <Modal visible={screenshotOpen} animationType="slide" transparent onRequestClose={() => setScreenshotOpen(false)}>
        <View style={advStyles.screenshotModalBackdrop}>
          <View style={advStyles.screenshotModalContent}>
            <View style={advStyles.screenshotModalHeader}>
              <Text style={advStyles.screenshotModalTitle}>📊 Portfolio Snapshot</Text>
              <TouchableOpacity onPress={() => setScreenshotOpen(false)}>
                <Ionicons name="close-circle" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <PnlScreenshotCard
              displayName="Trader"
              userId="ADVANCED"
              userInitials="A"
              todayPnl={summary.totalPnl}
              positions={positions}
              runningTime={runtime}
              currentTime={currentTime}
              positionSymbols={positions.map(p => p.trading_symbol).join(', ')}
              engineRunning={engineRunning}
              engineInterval="15"
            />
            
            {/* Share Button */}
            <TouchableOpacity 
              style={advStyles.screenshotShareBtn}
              onPress={() => {
                const pnlSign = summary.totalPnl >= 0 ? '+' : '';
                const dateStr = currentTime.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                const shareText = `📊 IndexPilot AI - Advanced Positions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 ${dateStr}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 P&L: ${pnlSign}₹${Math.abs(summary.totalPnl).toLocaleString('en-IN')}
📂 Positions: ${positions.length}
🏃 Running: ${summary.runningCount}
✅ Closed: ${summary.closedCount}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Active Symbols:
${positions.map(p => `• ${p.trading_symbol}: ${p.unrealized_pnl >= 0 ? '+' : ''}₹${Math.abs(p.unrealized_pnl || 0).toFixed(2)}`).join('\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 IndexPilot AI
#IndexPilotAI #AITrading`;
                Share.share({ message: shareText, title: 'IndexPilot AI - Advanced Positions' });
              }}
            >
              <Ionicons name="share-social" size={24} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', marginLeft: 8 }}>Share Portfolio</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Bottom Action Buttons */}
      {hasRunningPositions && (
        <View style={[advStyles.bottomActions, { paddingBottom: insets.bottom + 16 }]}>
          {/* Close All Positions Button */}
          {isClosingAll ? (
            <View style={advStyles.progressBar}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={advStyles.progressText}>
                Closing all {batchProgress.current} of {batchProgress.total}...
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={advStyles.closeAllBtn}
              onPress={handleCloseAll}
              activeOpacity={0.8}
            >
              <Ionicons name="close-circle" size={22} color="#fff" />
              <Text style={advStyles.closeAllText}>
                CLOSE ALL POSITIONS ({runningPositions.length})
              </Text>
            </TouchableOpacity>
          )}

          {/* Exit Selected Button */}
          {hasSelected && !isClosingAll && (
            <>
              {isExitingSelected ? (
                <View style={advStyles.progressBar}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={advStyles.progressText}>
                    Exiting {batchProgress.current} of {batchProgress.total}...
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={advStyles.exitSelectedBtn}
                  onPress={handleExitSelected}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-circle" size={22} color="#fff" />
                  <Text style={advStyles.exitSelectedText}>
                    EXIT SELECTED ({selectedIds.size})
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Animated Live Dot ────────────────────────────
function AnimatedLiveDot() {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.3, { duration: 600 }),
        withTiming(1, { duration: 600 })
      ),
      -1,
      true
    );
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View style={[advStyles.liveDot, style]} />
  );
}

// ─── Styles ────────────────────────────────────────
const advStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  animatedHeader: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  headerGlow: {
    position: 'absolute',
    top: -20,
    left: -40,
    right: -40,
    height: 100,
    borderRadius: 100,
    opacity: 0.15,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
    textAlign: 'center',
  },
  headerSubtitle: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  analyticsCard: {
    borderRadius: radius.lg,
    padding: spacing.base,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(180,154,255,0.15)',
  },
  analyticsTitle: {
    color: colors.text.disabled,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  analyticsItem: {
    width: (SCREEN_WIDTH - spacing.base * 2 - spacing.sm * 2 - spacing.base * 2) / 2,
    backgroundColor: colors.bg.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  analyticsLabel: {
    color: colors.text.disabled,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  analyticsValue: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,255,102,0.2)',
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00FF66',
    marginRight: spacing.sm,
  },
  liveBannerText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,255,102,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,255,102,0.3)',
  },
  switchBtnText: {
    color: '#00FF66',
    fontSize: 11,
    fontWeight: '700',
  },
  selectionToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(124,92,255,0.1)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(124,92,255,0.3)',
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectAllText: {
    color: '#B49AFF',
    fontSize: 13,
    fontWeight: '700',
  },
  selectedCount: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.text.secondary,
    marginTop: spacing.md,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
    marginTop: spacing.lg,
  },
  emptySubtext: {
    color: colors.text.disabled,
    fontSize: 13,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    backgroundColor: colors.bg.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    gap: spacing.sm,
  },
  closeAllBtn: {
    backgroundColor: '#FF3344',
    borderRadius: radius.lg,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#FF3344',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  closeAllText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  exitSelectedBtn: {
    backgroundColor: '#7C5CFF',
    borderRadius: radius.lg,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#7C5CFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  exitSelectedText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  progressBar: {
    backgroundColor: '#7C5CFF',
    borderRadius: radius.lg,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  progressText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  screenshotModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.base,
  },
  screenshotModalContent: {
    backgroundColor: '#0A0820',
    borderRadius: radius.xl,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: 'rgba(124, 92, 255, 0.3)',
  },
  screenshotModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  screenshotModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  screenshotShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7C5CFF',
    borderRadius: radius.md,
    paddingVertical: 16,
    marginTop: spacing.base,
    flex: 1,
    shadowColor: '#7C5CFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});
