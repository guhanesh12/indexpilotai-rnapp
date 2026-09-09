import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  Modal,
  Share,
  Platform,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import * as Application from 'expo-application';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useProfile, useReferral } from '../../src/hooks/useProfileData';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, withSequence, Easing } from 'react-native-reanimated';
import { Heading, Body } from '../../src/components/Primitives';
import { colors, spacing, typography, radius } from '../../src/lib/theme';
import { positionMonitorApi as pmApi, api } from '../../src/lib/api';
import PositionCard, { PositionItem } from '../../src/components/positions/PositionCard';
import PositionSummaryHeader from '../../src/components/positions/PositionSummaryHeader';
import PositionFilterBar, { PositionFilter } from '../../src/components/positions/PositionFilterBar';
import ImageAvailableModule from '../../src/components/positions/ImageAvailableModule';
import PnlScreenshotCard from '../../src/components/PnlScreenshotCard';

// ─── Mapper from API /positions to PositionItem ───────────────────
// Calculates P&L from (current - entry) * qty when direct pnl field not found
function calcPnlFromPrices(entry: number, current: number, qty: number, side: string): number {
  if (!entry || !current || !qty) return 0;
  const diff = current - entry;
  // For SELL (short), profit is when price decreases
  return side === 'SELL' ? -(diff * qty) : (diff * qty);
}

function mapApiPositionToPositionItem(src: any): PositionItem | null {
  if (!src) return null;
  // Determine fields with fallbacks for different response formats
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
  
  // P&L: try all possible field names from API
  let unrealizedPnl = Number(src.unrealized_pnl || src.unrealizedPnl || src.pnl || src.profitLoss || src.profit_loss || src.pnl_amount || src.PnL || 0);
  // If P&L is still 0 but we have prices, calculate it
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
  
  console.log('[PositionMonitor] Raw response type:', typeof res, Array.isArray(res) ? 'array' : typeof res);
  if (typeof res === 'object' && res !== null) {
    const keys = Object.keys(res).slice(0, 10);
    console.log('[PositionMonitor] Response keys:', keys.join(', '));
    // Log first 200 chars of stringified response for debugging
    const str = JSON.stringify(res).slice(0, 300);
    console.log('[PositionMonitor] Response preview:', str);
  }
  
  // Robust extraction: try all possible response structures
  let rawList: any[] = [];
  
  if (Array.isArray(res)) {
    // Direct array response
    rawList = res;
    console.log('[PositionMonitor] Extracted from: direct array');
  } else if (res?.data?.positions && Array.isArray(res.data.positions)) {
    // { success: true, data: { positions: [...] } }
    rawList = res.data.positions;
    console.log('[PositionMonitor] Extracted from: data.positions');
  } else if (res?.data?.livePositions && Array.isArray(res.data.livePositions)) {
    // { data: { livePositions: [...] } }
    rawList = res.data.livePositions;
    console.log('[PositionMonitor] Extracted from: data.livePositions');
  } else if (res?.data && Array.isArray(res.data)) {
    // { success: true, data: [...] }
    rawList = res.data;
    console.log('[PositionMonitor] Extracted from: data (direct array)');
  } else if (res?.data?.data && Array.isArray(res.data.data)) {
    // { data: { data: [...] } }
    rawList = res.data.data;
    console.log('[PositionMonitor] Extracted from: data.data');
  } else if (res?.positions && Array.isArray(res.positions)) {
    // { success: true, positions: [...] }
    rawList = res.positions;
    console.log('[PositionMonitor] Extracted from: positions');
  } else if (res?.livePositions && Array.isArray(res.livePositions)) {
    // { livePositions: [...] }
    rawList = res.livePositions;
    console.log('[PositionMonitor] Extracted from: livePositions');
  } else if (res?.activePositions && Array.isArray(res.activePositions)) {
    // { activePositions: [...] }
    rawList = res.activePositions;
    console.log('[PositionMonitor] Extracted from: activePositions');
  } else if (res?.monitor && Array.isArray(res.monitor)) {
    // { monitor: [...] }
    rawList = res.monitor;
    console.log('[PositionMonitor] Extracted from: monitor');
  } else if (res?.results && Array.isArray(res.results)) {
    // { results: [...] }
    rawList = res.results;
    console.log('[PositionMonitor] Extracted from: results');
  }
  
  console.log('[PositionMonitor] Raw list length:', rawList.length);
  if (rawList.length > 0) {
    console.log('[PositionMonitor] First item keys:', Object.keys(rawList[0]).slice(0, 15).join(', '));
  }
  
  const mapped = rawList.map(mapApiPositionToPositionItem).filter(Boolean) as PositionItem[];
  console.log(`[PositionMonitor] Mapped ${mapped.length}/${rawList.length} positions`);
  if (mapped.length > 0) {
    console.log('[PositionMonitor] Sample P&L:', {
      symbol: mapped[0].trading_symbol,
      pnl: mapped[0].unrealized_pnl,
      price: mapped[0].current_price,
      entry: mapped[0].entry_price,
      qty: mapped[0].quantity,
    });
  }
  return mapped;
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
  const runningPositions = positions.filter((p) => p.is_active && !p.is_closed);
  const closedPositions = positions.filter((p) => !p.is_active || p.is_closed);

  return {
    totalCount: positions.length,
    runningCount: runningPositions.length,
    closedCount: closedPositions.length,
    totalPnl: positions.reduce((sum, p) => sum + (p.unrealized_pnl || p.realized_pnl || 0), 0),
    runningPnl: runningPositions.reduce((sum, p) => sum + (p.unrealized_pnl || 0), 0),
    closedPnl: closedPositions.reduce((sum, p) => sum + (p.realized_pnl || 0), 0),
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

// ─── Main Screen ──────────────────────────────────
export default function PositionMonitorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { code: referralCodeObj } = useReferral();
  const [positions, setPositions] = useState<PositionItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<PositionFilter>('all');
  const [engineRunning, setEngineRunning] = useState(false);
  const [engineStartTime, setEngineStartTime] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // ── Selection state (selection is always ON for running positions) ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExitingSelected, setIsExitingSelected] = useState(false);
  const [isClosingAll, setIsClosingAll] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  
  // ── Screenshot/Portfolio snapshot state ──
  const [screenshotOpen, setScreenshotOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sharing, setSharing] = useState(false);
  const shareCardRef = useRef<any>(null);
  const pendingAutoShare = useRef(false);

  const displayName =
    (profile?.full_name && String(profile.full_name).trim().length > 0)
      ? profile.full_name
      : (user?.name && String(user.name).trim().length > 0)
        ? user.name
        : (user?.email ? String(user.email).split('@')[0] : 'Trader');
  let userId = 'GUEST';
  if (profile?.client_id) {
    userId = profile.client_id;
  } else if (user?.id) {
    userId = String(user.id).substring(0, 8).toUpperCase();
  }
  const referralCode = referralCodeObj?.code || null;
  const referralLink = referralCode
    ? `https://indexpilotai.com/register?ref=${referralCode}`
    : 'https://indexpilotai.com/register';
  
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Load positions using EXACT same data as Home screen ──
  // Home screen stores positions as raw array and accesses x.pnl / x.profitLoss
  const loadPositions = useCallback(async () => {
    try {
      // Same exact call as Home screen
      const res: any = await api.getLivePositions();
      // Same exact extraction
      const list = res?.positions ?? res?.data ?? res?.livePositions ?? [];
      const rawArr = Array.isArray(list) ? list : [];
      
      console.log(`[PositionMonitor] Count: ${rawArr.length}`);
      
      if (rawArr.length > 0) {
        // Log P&L from Home screen's field: x.pnl || x.profitLoss
        rawArr.forEach((x: any, i: number) => {
          if (i === 0) {
            console.log('[PositionMonitor] Keys:', Object.keys(x).slice(0, 15).join(', '));
          }
          const homePnl = x.pnl ?? x.profitLoss ?? 0;
          console.log(`[PositionMonitor] Item ${i}: symbol=${x.symbol||x.tradingSymbol}, pnl=${homePnl}, entry=${x.entryPrice||x.entry_price}, ltp=${x.ltp||x.currentPrice}`);
        });
        
        // Use exact same field reference as Home screen: x.pnl || x.profitLoss
        // Home screen in home.tsx: const t = arr.reduce((sum: number, x: any) => sum + (Number(x.pnl || x.profitLoss || 0) || 0), 0);
        const mapped: PositionItem[] = rawArr.map((x: any, idx: number) => {
          // EXACT P&L field from Home screen
          const pnl = Number(x.pnl || x.profitLoss || x.profit_loss || x.unrealizedProfit || 0);
          const entryPrice = Number(x.entry_price || x.entryPrice || x.avgPrice || x.buyAvg || x.costPrice || 0);
          const currentPrice = Number(x.current_price || x.currentPrice || x.ltp || x.lastPrice || x.costPrice || x.sellAvg || entryPrice);
          const qty = Math.max(0, Number(x.quantity || x.qty || x.buyQty || x.sellQty || x.netQty || 0));
          const side = (x.transaction_type || x.transactionType || x.side || 'BUY').toUpperCase();
          
          // Detect closed positions: netQty=0 means position is fully closed
          const netQty = Number(x.netQty || x.net_qty || 0);
          const isClosed = netQty === 0 || x.is_closed === true || x.status === 'closed' || x.status === 'exited';
          const isActive = !isClosed;
          
          // Use realizedProfit for closed positions, unrealizedProfit for open
          const realizedPnl = Number(x.realizedProfit || x.realized_profit || x.realizedPnl || 0);
          const unrealizedPnl = isClosed ? 0 : pnl;
          
          return {
            order_id: x.order_id || x.orderId || x.id || x.positionId || `pos_${idx}_${Date.now()}`,
            security_id: x.security_id || x.securityId || x.symbol_id || '',
            trading_symbol: x.trading_symbol || x.tradingSymbol || x.symbol || 'Unknown',
            exchange_segment: x.exchange_segment || 'NSE_FNO',
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
          } as PositionItem;
        });
        
        setPositions(mapped);
        console.log(`[PositionMonitor] Mapped ${mapped.length}. PnLs:`, mapped.map(m => `${m.trading_symbol}:${m.unrealized_pnl}`));
      }
    } catch (err: any) {
      console.warn('[PositionMonitor] Failed:', err.message);
      // Backup
      try {
        const backup: any = await api.getPositions();
        const bl = backup?.positions ?? backup?.data ?? (Array.isArray(backup) ? backup : []);
        const ba = Array.isArray(bl) ? bl : [];
        if (ba.length > 0) {
          const mapped: PositionItem[] = ba.map((x: any, i: number) => ({
            order_id: x.order_id || x.orderId || x.id || `pos_${i}_${Date.now()}`,
            security_id: x.security_id || '',
            trading_symbol: x.trading_symbol || x.symbol || 'Unknown',
            exchange_segment: 'NSE_FNO',
            transaction_type: 'BUY' as const,
            quantity: Math.max(0, Number(x.quantity || x.qty || 0)),
            entry_price: Number(x.entry_price || x.entryPrice || 0),
            current_price: Number(x.current_price || x.ltp || 0),
            target_amount: Number(x.target_amount || 0),
            stop_loss_amount: Number(x.stop_loss_amount || 0),
            unrealized_pnl: Number(x.pnl || x.profitLoss || x.unrealized_pnl || 0),
            is_active: true,
            trailing_enabled: false,
            trailing_step: 0.5,
          } as PositionItem));
          setPositions(mapped);
          console.log(`[PositionMonitor] Backup loaded ${mapped.length}`);
        }
      } catch {}
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Poll every 1 second while screen is focused ──
  useFocusEffect(
    useCallback(() => {
      loadPositions();

      // 1-second polling
      pollingRef.current = setInterval(loadPositions, 1000);

      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      };
    }, [loadPositions])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPositions();
    setRefreshing(false);
  };

  const handleTrailingToggle = async (item: PositionItem) => {
    try {
      await pmApi.updateTrailing({
        orderId: item.order_id,
        trailingEnabled: !item.trailing_enabled,
        trailingStep: item.trailing_step || 0.5,
      });

      const result = await pmApi.getList();
      if (result?.success && result?.positions) {
        setPositions(result.positions);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  // ── Filtered positions ──
  const filteredPositions = React.useMemo(() => {
    switch (activeFilter) {
      case 'running':
        return positions.filter((p) => p.is_active && !p.is_closed);
      case 'closed':
        return positions.filter((p) => !p.is_active || p.is_closed);
      default:
        return positions;
    }
  }, [positions, activeFilter]);

  const summary = calculateSummary(positions);
  const runtime = engineRunning && engineStartTime ? formatDuration(Date.now() - engineStartTime) : 'N/A';

  // ── Build share text (symbol names + overall profit + referral) ──
  const buildShareMessage = () => {
    const pnlSign = summary.totalPnl >= 0 ? '+' : '';
    const dateStr = currentTime.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const symbols = positions
      .map((p) => `• ${p.trading_symbol}`)
      .join('\n');
    return `📊 IndexPilot AI — Position Monitor

👤 ${displayName} (ID: ${userId})
📅 ${dateStr}
💰 Total P&L: ${pnlSign}₹${Math.abs(summary.totalPnl).toLocaleString('en-IN')}
📂 Positions: ${positions.length}   🏃 Running: ${summary.runningCount}   ✅ Closed: ${summary.closedCount}
⚡ Engine: ${engineRunning ? 'Running (15M)' : 'Stopped'}   ⏱ Runtime: ${runtime}

Active Symbols:
${symbols || 'No active symbols'}

🤖 Join IndexPilot AI — Verified AI Trading
🔗 Refer & earn: ${referralLink}
#IndexPilotAI #AITrading #SmartInvesting`;
  };

  const toContentUri = (fileUri: string): string | null => {
    if (Platform.OS !== 'android') return fileUri;
    const appId = Application.applicationId;
    if (!appId) return null;
    const filename = fileUri.split('/').pop()?.replace(/^file:\/\//, '') || '';
    if (!filename) return null;
    return `content://${appId}.SharingFileProvider/cached_expo_files/${filename}`;
  };

  // ── Capture screenshot and share image + content together ──
  const doCaptureAndShare = async () => {
    const message = buildShareMessage();
    try {
      setSharing(true);
      if (shareCardRef.current) {
        const uri = await captureRef(shareCardRef.current, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
        });
        if (uri) {
          if (Platform.OS === 'ios') {
            await Share.share({ message, url: uri, title: 'IndexPilot AI - Position Monitor' });
            return;
          }
          const contentUri = toContentUri(uri);
          if (contentUri) {
            try {
              await Share.share({ message, url: contentUri, title: 'IndexPilot AI - Position Monitor' });
              return;
            } catch (e) {
              console.log('[Share] content URI share failed:', e);
            }
          }
          const available = await Sharing.isAvailableAsync().catch(() => false);
          if (available) {
            await Sharing.shareAsync(uri, { mimeType: 'image/png' });
            await Clipboard.setStringAsync(message);
            Alert.alert('Shared', 'Screenshot shared. Share text copied to clipboard — paste it along with the image.');
            return;
          }
        }
      }
    } catch (e) {
      console.log('[Share] error:', e);
    } finally {
      setSharing(false);
    }
    await Share.share({ message, title: 'IndexPilot AI - Position Monitor' });
  };

  // ── Share button: open the snapshot, then auto-capture & share ──
  const handleShareScreenshot = () => {
    pendingAutoShare.current = true;
    setScreenshotOpen(true);
  };

  // Auto-share once the modal (and the card) is laid out
  useEffect(() => {
    if (screenshotOpen && pendingAutoShare.current) {
      const t = setTimeout(() => {
        pendingAutoShare.current = false;
        doCaptureAndShare().finally(() => setScreenshotOpen(false));
      }, 900);
      return () => clearTimeout(t);
    }
  }, [screenshotOpen]);

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

  // ── Exit Selected handler (only ticked positions) ──
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
              Alert.alert(
                '✅ Exit Complete',
                `Successfully exited ${successful} selected position(s).`
              );
            } else {
              Alert.alert(
                '⚠️ Exit Partial',
                `Successful: ${successful}\nFailed: ${failed}\n\nFailed symbols:\n${failedSymbols.join(', ')}`
              );
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

  // ── Close All Positions handler (exits ALL running positions) ──
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
              Alert.alert(
                '✅ All Positions Closed',
                `Successfully closed all ${successful} position(s).`
              );
            } else {
              Alert.alert(
                '⚠️ Close All Partial',
                `Successful: ${successful}\nFailed: ${failed}\n\nFailed symbols:\n${failedSymbols.join(', ')}`
              );
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

  // ── Render empty state ──
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="analytics-outline" size={64} color={colors.text.disabled} />
      <Text style={styles.emptyText}>
        {activeFilter === 'running'
          ? 'No running positions'
          : activeFilter === 'closed'
          ? 'No closed positions'
          : 'No positions available'}
      </Text>
      <Text style={styles.emptySubtext}>
        Positions will appear here when they are created
      </Text>
    </View>
  );

  // ── Loading state ──
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7C5CFF" />
          <Text style={styles.loadingText}>Loading positions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const hasRunningPositions = runningPositions.length > 0;
  const hasSelected = selectedIds.size > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Heading variant="h3">Position Monitor</Heading>
        <View style={styles.headerRight}>
          <TouchableOpacity
            testID="position-share-button"
            onPress={handleShareScreenshot}
            style={styles.shareHeaderBtn}
            activeOpacity={0.7}
            disabled={sharing}
          >
            {sharing ? (
              <ActivityIndicator size="small" color="#7C5CFF" />
            ) : (
              <Ionicons name="share-social-outline" size={18} color="#7C5CFF" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/advanced-positions' as any)}
            style={styles.advBtn}
          >
            <Ionicons name="sparkles" size={18} color="#FFB800" />
            <Text style={styles.advBtnText}>Advanced</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary Header */}
      <View style={styles.summaryContainer}>
        <PositionSummaryHeader
          data={{ ...summary, isEngineRunning: engineRunning, runtime }}
        />
      </View>

      {/* Info Banner */}
      <LinearGradient colors={['#8B5CF620', '#5238B610']} style={styles.banner}>
        <PulseDot />
        <Text style={styles.bannerText}>
          Live monitoring • Auto-refresh 1s • {filteredPositions.length} positions
        </Text>
      </LinearGradient>

      {/* Filter Bar */}
      <View style={styles.filterContainer}>
        <PositionFilterBar
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          runningCount={summary.runningCount}
          closedCount={summary.closedCount}
          allCount={summary.totalCount}
        />
      </View>

      {/* Select All Toolbar - Always shown when running positions exist */}
      {hasRunningPositions && (
        <View style={styles.selectionToolbar}>
          <TouchableOpacity style={styles.selectAllBtn} onPress={toggleSelectAllRunning}>
            <Ionicons
              name={selectedIds.size === runningPositions.length && runningPositions.length > 0 ? 'checkbox' : 'square-outline'}
              size={20}
              color={selectedIds.size === runningPositions.length && runningPositions.length > 0 ? '#7C5CFF' : colors.text.disabled}
            />
            <Text style={styles.selectAllText}>
              {selectedIds.size === runningPositions.length && runningPositions.length > 0 ? 'Deselect All' : 'Select All'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.selectedCount}>
            {selectedIds.size} of {runningPositions.length} selected
          </Text>
        </View>
      )}

      {/* Position List */}
      <ScrollView
        contentContainerStyle={[
          { paddingHorizontal: spacing.base, paddingBottom: insets.bottom + (hasRunningPositions ? 160 : 100) },
          filteredPositions.length === 0 && { flex: 1, justifyContent: 'center' },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#7C5CFF"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {filteredPositions.length === 0 ? (
          renderEmpty()
        ) : (
          filteredPositions.map((item) => (
            <PositionCard
              key={item.order_id}
              item={item}
              onExit={async () => {}} // Individual exit removed - use bottom buttons
              onTrailingToggle={handleTrailingToggle}
              isExiting={false}
              variant="default"
              isSelected={selectedIds.has(item.order_id)}
              onSelect={toggleSelection}
              selectionMode={item.is_active && !item.is_closed} // Always show selection for running
            />
          ))
        )}

        {/* Image Available Module */}
        {positions.length > 0 && (
          <View style={{ marginTop: spacing.md }}>
            <ImageAvailableModule
              onViewAll={() => {
                setScreenshotOpen(true);
              }}
              onCaptureScreenshot={() => {
                setScreenshotOpen(true);
              }}
              onShareAll={handleShareScreenshot}
              onRefresh={() => {
                loadPositions();
              }}
              onDownload={() => {
                setScreenshotOpen(true);
              }}
            />
          </View>
        )}
      </ScrollView>

      {/* Portfolio Screenshot Modal */}
      <Modal visible={screenshotOpen} animationType="slide" transparent onRequestClose={() => setScreenshotOpen(false)}>
        <View style={styles.screenshotModalBackdrop}>
          <View style={styles.screenshotModalContent}>
            <View style={styles.screenshotModalHeader}>
              <Text style={styles.screenshotModalTitle}>📊 Portfolio Snapshot</Text>
              <TouchableOpacity onPress={() => setScreenshotOpen(false)}>
                <Ionicons name="close-circle" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <View ref={shareCardRef} collapsable={false}>
              <PnlScreenshotCard
                displayName={displayName}
                userId={userId}
                userInitials={displayName.charAt(0).toUpperCase()}
                todayPnl={summary.totalPnl}
                totalPnl={summary.totalPnl}
                positions={positions}
                runningTime={runtime}
                currentTime={currentTime}
                positionSymbols={positions.map(p => p.trading_symbol).join(', ')}
                engineRunning={engineRunning}
                engineInterval="15"
                referralLink={referralLink}
              />
            </View>
            
            {/* Share Button */}
            <TouchableOpacity 
              style={styles.screenshotShareBtn}
              onPress={doCaptureAndShare}
              disabled={sharing}
            >
              {sharing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="share-social" size={24} color="#fff" />
              )}
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', marginLeft: 8 }}>Share Portfolio</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Bottom Action Buttons - Fixed at bottom */}
      {hasRunningPositions && (
        <View style={[styles.bottomActions, { paddingBottom: insets.bottom + 16 }]}>
          {/* Close All Positions Button */}
          {isClosingAll ? (
            <View style={styles.progressBar}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.progressText}>
                Closing all {batchProgress.current} of {batchProgress.total}...
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.closeAllBtn}
              onPress={handleCloseAll}
              activeOpacity={0.8}
            >
              <Ionicons name="close-circle" size={22} color="#fff" />
              <Text style={styles.closeAllText}>
                CLOSE ALL POSITIONS ({runningPositions.length})
              </Text>
            </TouchableOpacity>
          )}

          {/* Exit Selected Button - only when ticked */}
          {hasSelected && !isClosingAll && (
            <>
              {isExitingSelected ? (
                <View style={styles.progressBar}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.progressText}>
                    Exiting {batchProgress.current} of {batchProgress.total}...
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.exitSelectedBtn}
                  onPress={handleExitSelected}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-circle" size={22} color="#fff" />
                  <Text style={styles.exitSelectedText}>
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

// ─── Pulse Dot for banner ────────────────────────
function PulseDot() {
  const opacity = useSharedValue(0.4);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.bannerDot, style]} />;
}

// ─── Styles ────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  advBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,184,0,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.3)',
  },
  advBtnText: {
    color: '#FFB800',
    fontSize: 12,
    fontWeight: '800',
  },
  shareHeaderBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(124,92,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(124,92,255,0.35)',
  },
  summaryContainer: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.base,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#8B5CF644',
  },
  bannerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8B5CF6',
    marginRight: spacing.sm,
  },
  bannerText: {
    color: colors.text.secondary,
    fontSize: 12,
    flex: 1,
  },
  filterContainer: {
    paddingHorizontal: spacing.base,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  selectionToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.base,
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
