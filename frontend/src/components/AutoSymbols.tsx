import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, ActivityIndicator, TextInput, Switch } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Card, Heading, Body, Button } from '../../src/components/Primitives';
import { colors, spacing, radius } from '../../src/lib/theme';
import { api } from '../../src/lib/api';
import AddFundsModal from './AddFundsModal';
import { emitRefetch } from '../lib/refetchEvents';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { showToast } from '../lib/toast';

const INDICES = ['NIFTY', 'BANKNIFTY', 'SENSEX'];
const MONEYNESS = ['ATM', 'ITM1', 'ITM2', 'OTM1', 'OTM2'];

// Moneyness multipliers - MUST be identical to backend
const MONEYNESS_MULTIPLIERS: Record<string, { tgt: number; sl: number }> = {
  ITM2: { tgt: 0.70, sl: 1.30 },
  ITM1: { tgt: 0.85, sl: 1.15 },
  ATM:  { tgt: 1.00, sl: 1.00 },
  OTM1: { tgt: 1.20, sl: 0.85 },
  OTM2: { tgt: 1.50, sl: 0.70 },
};

 // Slot heading colors + highlight bar
const SLOT_THEME: Record<number, { titleColor: string; indicatorColor: string; enabledBg: string; disabledBg: string }> = {
  1: { titleColor: '#7C5CFF', indicatorColor: '#7C5CFF', enabledBg: 'rgba(124,92,255,0.18)', disabledBg: 'rgba(124,92,255,0.06)' },
  2: { titleColor: '#00FFE0', indicatorColor: '#00FFE0', enabledBg: 'rgba(0,255,224,0.18)', disabledBg: 'rgba(0,255,224,0.06)' },
  3: { titleColor: '#FFB020', indicatorColor: '#FFB020', enabledBg: 'rgba(255,176,32,0.18)', disabledBg: 'rgba(255,176,32,0.06)' },
};

// Default values for new slot
const DEFAULT_SLOT_VALUES = {
  lot_count: 1,
  enabled: true,
  index_name: 'NIFTY',
  moneyness: 'ATM',
  target_per_lot: 500,
  stop_loss_per_lot: 300,
  trailing_enabled: true,
  trailing_activation_per_lot: 4000,
  trailing_step_per_lot: 1000,
};

type AutoSymbolSlot = {
  slot: number;
  index_name: string;
  moneyness: string;
  lot_count: number;
  enabled: boolean;
  target_per_lot: number;
  stop_loss_per_lot: number;
  trailing_enabled: boolean;
  trailing_activation_per_lot: number;
  trailing_step_per_lot: number;
};

export default function AutoSymbols() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [slots, setSlots] = useState<AutoSymbolSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [brokerConnected, setBrokerConnected] = useState(false);
  const [brokerChecking, setBrokerChecking] = useState(false);
  const [previewing, setPreviewing] = useState<number | null>(null);
  const [bigView, setBigView] = useState(false); // Toggle for Big view

  // Slot purchase / quota
  const [maxSlots, setMaxSlots] = useState<number>(3);
  const [freeSlots, setFreeSlots] = useState<number>(3);
  const [extraSlots, setExtraSlots] = useState<number>(0);
  const [slotPrice, setSlotPrice] = useState<number>(49);
  const [hardCap, setHardCap] = useState<number>(20);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [buyingExtra, setBuyingExtra] = useState(false);

  const [addFundsOpen, setAddFundsOpen] = useState(false);

  useEffect(() => {
    loadAll();
    checkBroker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAll = async () => {
    await Promise.all([loadConfig(), refreshWalletBalance()]);
  };

  const refreshWalletBalance = async () => {
    try {
      const res: any = await api.getWalletBalance();
      const b = res?.balance ?? res?.data?.balance ?? res?.wallet?.balance ?? 0;
      setWalletBalance(Number(b) || 0);
      return Number(b) || 0;
    } catch (e) {
      console.log('Failed to refresh wallet balance', e);
      return 0;
    }
  };

  const refreshAllAfterBuy = async () => {
    await Promise.all([loadConfig(), refreshWalletBalance()]);
    emitRefetch('wallet:refresh', { source: 'autoSymbols:buyExtraSlot' });
    emitRefetch('autoSymbols:refresh', { source: 'autoSymbols:buyExtraSlot' });
  };

  const createOrEnablePurchasedSlot = async (newSlot: number) => {
    try {
      // 1) Always re-fetch current config after purchase
      // 2) If the slot already exists in backend, persist enabled + full object from backend
      //    (prevents mismatches like wrong index_name for slot 4/5)
      await loadConfig();

      const refreshed = await api.getAutoSymbolConfig();
      const slotsFromServer: any[] = Array.isArray(refreshed?.slots) ? refreshed.slots : [];
      const existing = slotsFromServer.find(s => Number(s.slot) === Number(newSlot));

      if (existing) {
        const slotPayload = {
          ...existing,
          enabled: true,
        };

        console.log('[createOrEnablePurchasedSlot] POST /auto-symbol/config (enable existing slot)', slotPayload);
        await api.saveAutoSymbolSlot(slotPayload);
        console.log('[createOrEnablePurchasedSlot] Enabled slot from server config');
        return;
      }

      // If backend didn't create the config row yet, create it with safe defaults.
      const payload = {
        slot: newSlot,
        index_name: INDICES[(newSlot - 1) % 3],
        moneyness: 'ATM',
        lot_count: 1,
        enabled: true,
        target_per_lot: 6000,
        stop_loss_per_lot: 3000,
        trailing_enabled: true,
        trailing_activation_per_lot: 4000,
        trailing_step_per_lot: 1000,
      };

      console.log('[createOrEnablePurchasedSlot] POST /auto-symbol/config (create default slot)', payload);
      await api.saveAutoSymbolSlot(payload as any);
      console.log('[createOrEnablePurchasedSlot] Created default config for purchased slot');
    } catch (e: any) {
      console.error('[createOrEnablePurchasedSlot] Failed after purchase:', e);
      showToast('Slot purchased, but failed to persist config for the new slot. Configure manually.');
    }
  };

  const buyExtraSlot = async () => {
    if (buyingExtra) return;
    if (maxSlots >= hardCap) {
      showToast(`Maximum ${hardCap} slots reached`);
      return;
    }

    Alert.alert(
      'Confirm Purchase',
      `Buy 1 extra symbol slot for ₹${slotPrice}? Amount will be debited from your wallet.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Buy Slot ₹${slotPrice}`,
          onPress: async () => {
            setBuyingExtra(true);
            console.log('[buyExtraSlot] POST', '/auto-symbol/purchase-slot');

            try {
              const res: any = await api.purchaseExtraSlot();
              console.log('[buyExtraSlot] response', 200, res);

              // On success:
              const new_slot = res?.new_slot ?? maxSlots + 1;
              const wallet_balance = res?.wallet_balance ?? walletBalance;

              showToast(
                `✅ Slot ${new_slot} unlocked! ₹${slotPrice} debited. Wallet: ₹${wallet_balance.toFixed(2)}`
              );

              // Persist/enable the newly unlocked slot using backend slot object (prevents slot-4/5 mismatch)
              await createOrEnablePurchasedSlot(new_slot);

              // Refresh config to get the new slot list and max_slots
              await loadConfig();

              // Refresh wallet balance
              await refreshWalletBalance();

              // Notify other parts of the app
              emitRefetch('wallet:refresh', { source: 'autoSymbols:buyExtraSlot' });
              emitRefetch('autoSymbols:refresh', { source: 'autoSymbols:buyExtraSlot:postCreate' });

            } catch (e: any) {
              const errorBody = e.message || '{}';
              console.log('[buyExtraSlot] response', e.status || 'error', errorBody);

              try {
                const parsedError = JSON.parse(errorBody);
                // Case: Insufficient balance (402)
                if (parsedError?.need_recharge === true) {
                  showToast(parsedError.error || 'You need to recharge your wallet first.');
                  // Open Wallet Recharge screen
                  router.push('/(tabs)/walletRecharge' as any);
                  return; // Stop execution
                }

                // Any other known error from backend
                showToast(`Purchase failed: ${parsedError.error || 'An unknown error occurred.'}`);

              } catch (parseError) {
                // Case: Non-JSON error message
                showToast(`Purchase failed: ${errorBody}`);
              }
            } finally {
              setBuyingExtra(false);
            }
          },
        },
      ]
    );
  };

  const loadConfig = async () => {
    setQuotaLoading(true);
    setLoading(true);
    try {
      const res: any = await api.getAutoSymbolConfig();
      if (res?.success) {
        if (Array.isArray(res.slots)) setSlots(res.slots);

        // UI requirements fields (safe defaults)
        const ms = Number(res?.max_slots ?? res?.maxSlots ?? 3);
        const fs = Number(res?.free_slots ?? res?.freeSlots ?? 3);
        const es = Number(res?.extra_slots ?? res?.extraSlots ?? 0);
        const sp = Number(res?.slot_price ?? res?.slotPrice ?? 49);
        const hc = Number(res?.hard_cap ?? res?.hardCap ?? 20);

        setMaxSlots(Number.isFinite(ms) && ms > 0 ? ms : 3);
        setFreeSlots(Number.isFinite(fs) ? fs : 3);
        setExtraSlots(Number.isFinite(es) ? es : 0);
        setSlotPrice(Number.isFinite(sp) ? sp : 49);
        setHardCap(Number.isFinite(hc) ? hc : 20);
      }
    } catch (e) {
      console.log('Failed to load auto-symbols config', e);
    } finally {
      setQuotaLoading(false);
      setLoading(false);
    }
  };

  const checkBroker = async () => {
    setBrokerChecking(true);
    try {
      // Use passive status check to see if broker credentials are saved and connected
      const res: any = await api.getBrokerStatusPassive();
      const credentials = res?.credentials;
      if (credentials) {
        const expired = credentials.access_token_expiry 
          ? new Date(credentials.access_token_expiry).getTime() <= Date.now() 
          : false;
        const status = credentials.last_status || 'not_connected';
        const connected = (status === 'connected' || status === 'keys_saved') && !expired;
        setBrokerConnected(connected);
      } else {
        setBrokerConnected(false);
      }
    } catch (e) {
      console.warn('[AutoSymbols] Broker check failed:', e);
      setBrokerConnected(false);
    } finally {
      setBrokerChecking(false);
    }
  };

const getSlot = (slotNum: number): AutoSymbolSlot => {
    return slots.find(s => s.slot === slotNum) || {
      slot: slotNum,
      ...DEFAULT_SLOT_VALUES,
    };
  };

  // Compute effective values based on moneyness multipliers
  const computeEffective = (slot: AutoSymbolSlot) => {
    const mult = MONEYNESS_MULTIPLIERS[slot.moneyness] || MONEYNESS_MULTIPLIERS.ATM;
    return {
      effectiveTarget: slot.target_per_lot * slot.lot_count * mult.tgt,
      effectiveStopLoss: slot.stop_loss_per_lot * slot.lot_count * mult.sl,
      effectiveTrailActivate: slot.trailing_activation_per_lot * slot.lot_count * mult.tgt,
      effectiveTrailStep: slot.trailing_step_per_lot * slot.lot_count,
    };
  };

const updateSlot = async (newSlot: AutoSymbolSlot, showToast = true) => {
    // Auto-update trailing values based on target/SL
    const oldSlot = getSlot(newSlot.slot);
    if (newSlot.target_per_lot !== oldSlot.target_per_lot) {
        newSlot.trailing_activation_per_lot = Math.round(newSlot.target_per_lot * 0.66);
    }
    if (newSlot.stop_loss_per_lot !== oldSlot.stop_loss_per_lot) {
        newSlot.trailing_step_per_lot = Math.round(newSlot.stop_loss_per_lot * 0.33);
    }

    // Optimistic update
    const newSlots = [...slots.filter(s => s.slot !== newSlot.slot), newSlot];
    setSlots(newSlots);

    try {
      await api.saveAutoSymbolSlot(newSlot);
      if (showToast) {
        Alert.alert('Success', `Slot ${newSlot.slot} saved successfully`);
      }
    } catch (e: any) {
      if (showToast) {
        Alert.alert('Save Failed', e.message);
      }
      loadConfig(); // Reload from server
    }
  };

  const handleToggleSlot = (slotToToggle: AutoSymbolSlot, isEnabled: boolean) => {
    // Allow enable/disable for both free + paid slots.
    // If backend later decides otherwise, it will reject and updateSlot() will reload from server.
    updateSlot({ ...slotToToggle, enabled: isEnabled });
  };

  const deleteSlot = async (slotNum: number) => {
    Alert.alert('Delete Slot', `Are you sure you want to delete Slot ${slotNum}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.deleteAutoSymbolSlot(slotNum);
          await loadConfig();
        } catch (e: any) {
          Alert.alert('Delete Failed', e.message);
        }
      }}
    ]);
  };

  const previewContract = async (slot: AutoSymbolSlot) => {
    setPreviewing(slot.slot);
    try {
      // We send a mock ltp to get a strike based on moneyness, and hardcode option_type for preview
      const res: any = await api.resolveAutoSymbol({
        index_name: slot.index_name,
        ltp: slot.index_name === 'NIFTY' ? 22000 : slot.index_name === 'BANKNIFTY' ? 48000 : 73000, // mock ltp
        option_type: 'CE',
        moneyness: slot.moneyness
      });

      if (res?.success && res.resolved) {
        Alert.alert(
          'Contract Preview (Call)',
          `Symbol: ${res.resolved.symbol}\nStrike: ${res.resolved.strike_price}\nExpiry: ${res.resolved.expiry_date}\nLot Size: ${res.resolved.lot_size}`
        );
      } else {
        Alert.alert('Preview Failed', 'Could not resolve symbol');
      }
    } catch (e: any) {
      Alert.alert('Preview Failed', e.message);
    } finally {
      setPreviewing(null);
    }
  };

  const isAutoON = slots.some(s => s.enabled);

  return (
    <View style={styles.container}>
      <View style={{ padding: spacing.base, paddingBottom: 0 }}>
<View style={styles.statusRow}>
          <View style={[styles.badge, isAutoON ? styles.badgeOn : styles.badgeOff]}>
            <View style={[styles.dot, isAutoON ? styles.dotOn : styles.dotOff]} />
            <Text style={[styles.badgeText, isAutoON ? styles.badgeTextOn : styles.badgeTextOff]}>
              Auto Symbol {isAutoON ? 'ON' : 'OFF'}
            </Text>
          </View>
          <TouchableOpacity onPress={checkBroker} disabled={brokerChecking}>
            <View style={[styles.badge, brokerConnected ? styles.badgeOn : styles.badgeOff, { backgroundColor: 'transparent', borderWidth: 1, borderColor: brokerConnected ? '#00FF66' : colors.border.default }]}>
              {brokerChecking ? (
                <ActivityIndicator size="small" color={colors.text.secondary} style={{ marginRight: 6 }} />
              ) : (
                <View style={[styles.dot, brokerConnected ? styles.dotOn : styles.dotOff]} />
              )}
              <Text style={{ color: brokerConnected ? '#00FF66' : colors.text.secondary, fontSize: 12, fontWeight: '700' }}>
                Broker {brokerConnected ? 'Connected' : 'Disconnected'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {isAutoON && (
          <Text style={{ color: 'rgba(0,255,102,0.8)', fontSize: 12, marginTop: 10, fontWeight: '600' }}>
            Manual symbols not required when auto slots exist.
          </Text>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.base, paddingBottom: insets.bottom + 81, ...(bigView ? { padding: spacing.sm } : {}) }}>
        {/* Caption + purchase card (Auto tab only) */}
        <View style={{ marginBottom: spacing.base }}>
          <View style={styles.slotQuotaRow}>
            <View style={styles.slotQuotaBadge}>
              <Text style={styles.slotQuotaText}>Slots: <Text style={{color: '#00FF66', fontWeight: '900'}}>{maxSlots}</Text> ({freeSlots} free + {extraSlots} paid)</Text>
            </View>
            <View style={[styles.badge, isAutoON ? styles.badgeOn : styles.badgeOff, { marginLeft: 'auto' }]}>
              <View style={[styles.dot, isAutoON ? styles.dotOn : styles.dotOff]} />
              <Text style={[styles.badgeText, isAutoON ? styles.badgeTextOn : styles.badgeTextOff]}>
                {isAutoON ? 'AUTO ACTIVE' : 'AUTO OFF'}
              </Text>
            </View>
          </View>

          {Number(maxSlots) < hardCap && (
            <LinearGradient colors={['rgba(255,176,32,0.12)', 'rgba(255,176,32,0.04)']} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.needMoreCard}>
              <View style={styles.needMoreContent}>
                <View style={styles.needMoreIcon}>
                  <Ionicons name="diamond" size={22} color="#FFB020" />
                </View>
                <View style={{flex:1}}>
                  <Text style={styles.needMoreTitle}>Unlock More Trading Power</Text>
                  <Text style={styles.needMoreBody}>
                    Add slot {maxSlots + 1} of {hardCap} — just ₹{slotPrice} from your wallet
                  </Text>
                </View>
                <TouchableOpacity style={styles.buyBtn} onPress={buyExtraSlot} disabled={buyingExtra}>
                  <Ionicons name="add-circle" size={16} color="#000" style={{marginRight:4}} />
                  <Text style={styles.buyBtnText}>{buyingExtra ? '...' : `Buy ₹${slotPrice}`}</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          )}
        </View>

        {Array.from({ length: maxSlots }, (_, i) => i + 1).map(slotNum => {
          const slot = getSlot(slotNum);
          const theme = SLOT_THEME[slotNum] ?? SLOT_THEME[1];
          const isActive = !!slot.enabled;
          const eff = computeEffective(slot);

          return (
            <Card key={slotNum} style={{ marginBottom: spacing.base, borderLeftWidth: 3, borderLeftColor: isActive ? theme.indicatorColor : 'transparent', overflow: 'hidden' }}>
              {/* ── HEADER: Slot number + Toggle ── */}
              <View style={styles.slotHeader}>
                <View style={[styles.slotTitleRow, { backgroundColor: isActive ? theme.enabledBg : theme.disabledBg }]}>
                  <View style={[styles.slotIndicator, { backgroundColor: theme.indicatorColor }]} />
                  <View>
                    <Text style={[styles.slotTitle, { color: theme.titleColor }]}>Slot {slotNum}</Text>
                    <Text style={styles.slotSubtitle}>
                      {slot.index_name === 'BANKNIFTY' ? 'BANKNIFTY' : slot.index_name} · {slot.moneyness} · {slot.lot_count} lot{slot.lot_count > 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
                <View style={{flexDirection:'row', alignItems:'center', gap: 8}}>
                  <View style={[styles.statusMiniBadge, {backgroundColor: isActive ? 'rgba(0,255,102,0.12)' : colors.bg.tertiary}]}>
                    <View style={[styles.miniDot, {backgroundColor: isActive ? '#00FF66' : colors.text.disabled}]} />
                    <Text style={[styles.statusMiniText, {color: isActive ? '#00FF66' : colors.text.secondary}]}>{isActive ? 'ON' : 'OFF'}</Text>
                  </View>
                  <Switch
                    value={slot.enabled}
                    onValueChange={(val) => handleToggleSlot(slot, val)}
                    trackColor={{ false: colors.bg.tertiary, true: '#00FF66' }}
                    thumbColor="#fff"
                    style={{transform: [{scaleX: 0.8}, {scaleY: 0.8}]}}
                  />
                </View>
              </View>

              {/* ── SECTION 1: ⚙️ Configuration ── */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="settings-outline" size={14} color={theme.titleColor} />
                  <Text style={[styles.sectionTitle, {color: theme.titleColor}]}>CONFIGURATION</Text>
                </View>
                {/* Index Buttons - Full Width Row */}
                <View style={{marginBottom: spacing.sm}}>
                  <Text style={styles.fieldLabel}>Index</Text>
                  <View style={styles.indexBtnRow}>
                    {INDICES.map(idx => (
                      <TouchableOpacity
                        key={idx}
                        style={[styles.optionBtnWide, slot.index_name === idx && {borderColor: theme.titleColor, backgroundColor: theme.enabledBg}]}
                        onPress={() => updateSlot({ ...slot, index_name: idx })}
                      >
                        <Text style={[styles.optionTextWide, slot.index_name === idx && {color: theme.titleColor, fontWeight:'800'}]}>
                          {idx === 'BANKNIFTY' ? 'BANKNIFTY' : idx}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                {/* Lots Row */}
                <View style={{marginBottom: spacing.sm}}>
                  <Text style={styles.fieldLabel}>Lots</Text>
                  <View style={styles.lotControl}>
                    <TouchableOpacity style={styles.lotBtn} onPress={() => updateSlot({...slot, lot_count: Math.max(1, slot.lot_count - 1)}, false)}>
                      <Ionicons name="remove" size={16} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.lotText}>{slot.lot_count}</Text>
                    <TouchableOpacity style={styles.lotBtn} onPress={() => updateSlot({...slot, lot_count: Math.min(50, slot.lot_count + 1)}, false)}>
                      <Ionicons name="add" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
                {/* Moneyness Row (full width - single line) */}
                <View style={{borderTopWidth: 1, borderTopColor: colors.border.default, paddingTop: spacing.sm}}>
                  <Text style={styles.fieldLabel}>Moneyness</Text>
                  <View style={styles.moneynessRow}>
                    {MONEYNESS.map(m => (
                      <TouchableOpacity
                        key={m}
                        style={[styles.moneynessBtn, slot.moneyness === m && {borderColor: theme.titleColor, backgroundColor: theme.enabledBg}]}
                        onPress={() => updateSlot({ ...slot, moneyness: m })}
                      >
                        <Text style={[styles.moneynessText, slot.moneyness === m && {color: theme.titleColor, fontWeight:'800'}]}>
                          {m === 'ITM1' ? 'ITM' : m === 'ITM2' ? 'ITM2' : m === 'ATM' ? 'ATM' : m === 'OTM1' ? 'OTM' : 'OTM2'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* ── SECTION 2: 🎯 Risk Management ── */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="flag-outline" size={14} color="#00FF66" />
                  <Text style={[styles.sectionTitle, {color: '#00FF66'}]}>RISK MANAGEMENT</Text>
                </View>
                <View style={styles.twoColumnRow}>
                  <View style={styles.riskInputGroup}>
                    <View style={{flexDirection:'row', alignItems:'center', gap: 4, marginBottom: 6}}>
                      <Ionicons name="trending-up" size={14} color="#00FF66" />
                      <Text style={styles.riskInputLabel}>Target ₹/lot</Text>
                    </View>
                    <TextInput
                      style={[styles.riskInput, isActive && styles.riskInputActive]}
                      value={String(slot.target_per_lot)}
                      onChangeText={(text) => {
                        const num = parseFloat(text) || 0;
                        updateSlot({ ...slot, target_per_lot: num, trailing_activation_per_lot: Math.round(num * 0.66) }, false);
                      }}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.text.disabled}
                    />
                  </View>
                  <View style={styles.riskInputGroup}>
                    <View style={{flexDirection:'row', alignItems:'center', gap: 4, marginBottom: 6}}>
                      <Ionicons name="shield-checkmark" size={14} color="#FF3344" />
                      <Text style={styles.riskInputLabel}>Stop-Loss ₹/lot</Text>
                    </View>
                    <TextInput
                      style={[styles.riskInput, isActive && styles.riskInputActive]}
                      value={String(slot.stop_loss_per_lot)}
                      onChangeText={(text) => {
                        const num = parseFloat(text) || 0;
                        updateSlot({ ...slot, stop_loss_per_lot: num, trailing_step_per_lot: Math.round(num * 0.33) }, false);
                      }}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.text.disabled}
                    />
                  </View>
                </View>
              </View>

              {/* ── SECTION 3: 🔒 Trailing Stop-Loss ── */}
              <View style={styles.sectionCard}>
                <View style={styles.trailingHeaderRow}>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="move-outline" size={14} color="#7C5CFF" />
                    <Text style={[styles.sectionTitle, {color: '#7C5CFF'}]}>TRAILING STOP-LOSS</Text>
                  </View>
                  <Switch
                    value={slot.trailing_enabled}
                    onValueChange={(val) => updateSlot({ ...slot, trailing_enabled: val }, false)}
                    trackColor={{ false: colors.bg.tertiary, true: '#7C5CFF' }}
                    thumbColor="#fff"
                    style={{transform: [{scaleX: 0.75}, {scaleY: 0.75}]}}
                  />
                </View>
                {slot.trailing_enabled && (
                  <View style={styles.twoColumnRow}>
                    <View style={styles.riskInputGroup}>
                      <Text style={styles.riskInputLabel}>Activate at ₹/lot</Text>
                      <TextInput
                        style={[styles.riskInput, isActive && styles.riskInputActive]}
                        value={String(slot.trailing_activation_per_lot)}
                        onChangeText={(text) => {
                          const num = parseFloat(text) || 0;
                          updateSlot({ ...slot, trailing_activation_per_lot: num }, false);
                        }}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={colors.text.disabled}
                      />
                    </View>
                    <View style={styles.riskInputGroup}>
                      <Text style={styles.riskInputLabel}>Step ₹/lot</Text>
                      <TextInput
                        style={[styles.riskInput, isActive && styles.riskInputActive]}
                        value={String(slot.trailing_step_per_lot)}
                        onChangeText={(text) => {
                          const num = parseFloat(text) || 0;
                          updateSlot({ ...slot, trailing_step_per_lot: num }, false);
                        }}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={colors.text.disabled}
                      />
                    </View>
                  </View>
                )}
              </View>

              {/* ── SECTION 4: 📊 Summary ── */}
              <View style={[styles.sectionCard, {backgroundColor: 'rgba(124,92,255,0.06)', borderWidth: 1, borderColor: 'rgba(124,92,255,0.15)'}]}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="analytics-outline" size={14} color="#7C5CFF" />
                  <Text style={[styles.sectionTitle, {color: '#7C5CFF'}]}>EFFECTIVE VALUES</Text>
                </View>
                <View style={styles.summaryGrid}>
                  <View style={[styles.summaryItem, {backgroundColor: 'rgba(0,255,102,0.08)'}]}>
                    <Text style={styles.summaryLabel}>Target</Text>
                    <Text style={[styles.summaryValue, {color: '#00FF66'}]}>₹{Math.round(eff.effectiveTarget)}</Text>
                  </View>
                  <View style={[styles.summaryItem, {backgroundColor: 'rgba(255,51,68,0.08)'}]}>
                    <Text style={styles.summaryLabel}>Stop Loss</Text>
                    <Text style={[styles.summaryValue, {color: '#FF3344'}]}>₹{Math.round(eff.effectiveStopLoss)}</Text>
                  </View>
                  <View style={[styles.summaryItem, {backgroundColor: slot.trailing_enabled ? 'rgba(124,92,255,0.08)' : 'rgba(69,69,75,0.3)'}]}>
                    <Text style={styles.summaryLabel}>Trail Activate</Text>
                    <Text style={[styles.summaryValue, {color: slot.trailing_enabled ? '#7C5CFF' : colors.text.disabled}]}>
                      {slot.trailing_enabled ? `₹${Math.round(eff.effectiveTrailActivate)}` : '—'}
                    </Text>
                  </View>
                  <View style={[styles.summaryItem, {backgroundColor: slot.trailing_enabled ? 'rgba(124,92,255,0.08)' : 'rgba(69,69,75,0.3)'}]}>
                    <Text style={styles.summaryLabel}>Trail Step</Text>
                    <Text style={[styles.summaryValue, {color: slot.trailing_enabled ? '#7C5CFF' : colors.text.disabled}]}>
                      {slot.trailing_enabled ? `₹${Math.round(eff.effectiveTrailStep)}` : '—'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* ── ACTIONS ── */}
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.previewBtn}
                  onPress={() => previewContract(slot)}
                  disabled={previewing === slot.slot}
                >
                  {previewing === slot.slot ? (
                    <ActivityIndicator size="small" color={theme.titleColor} />
                  ) : (
                    <>
                      <Ionicons name="eye-outline" size={15} color={theme.titleColor} style={{ marginRight: 4 }} />
                      <Text style={[styles.previewBtnText, {color: theme.titleColor}]}>Preview</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.deleteBtn, slotNum <= freeSlots && { opacity: 0.4 }]}
                  onPress={() => deleteSlot(slotNum)}
                  disabled={slotNum <= freeSlots}
                >
                  <Ionicons name="trash-outline" size={16} color="#FF3344" />
                </TouchableOpacity>
              </View>
            </Card>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeOn: {
    backgroundColor: 'rgba(0,255,102,0.15)',
  },
  badgeOff: {
    backgroundColor: colors.bg.tertiary,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  dotOn: {
    backgroundColor: '#00FF66',
    shadowColor: '#00FF66',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  dotOff: {
    backgroundColor: colors.text.disabled,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeTextOn: {
    color: '#00FF66',
  },
  badgeTextOff: {
    color: colors.text.secondary,
  },
  // ── SLOT QUOTA ROW ──
  slotQuotaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  slotQuotaBadge: {
    backgroundColor: colors.bg.tertiary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  slotQuotaText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  // ── SLOT HEADER ──
  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.base,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  slotTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  slotIndicator: {
    width: 4,
    height: 28,
    borderRadius: 6,
  },
  slotTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  slotSubtitle: {
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  // ── STATUS MINI BADGE ──
  statusMiniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  miniDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 5,
  },
  statusMiniText: {
    fontSize: 10,
    fontWeight: '800',
  },
  // ── SECTION CARD ──
  sectionCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: 10,
    padding: spacing.base,
    marginBottom: spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.base,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  // ── CONFIG ROW ──
  configRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  indexSection: {
    flex: 1,
    marginRight: spacing.sm,
  },
  lotsSection: {
    width: 75,
  },
  // ── FIELD LABEL ──
  fieldLabel: {
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  // ── MONEYNESS ROW (ultra compact, single line) ──
  moneynessRow: {
    flexDirection: 'row',
    gap: 3,
  },
  moneynessBtn: {
    backgroundColor: colors.bg.tertiary,
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'transparent',
    flex: 1,
    alignItems: 'center',
  },
  moneynessText: {
    color: colors.text.secondary,
    fontSize: 9,
    fontWeight: '700',
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  optionBtn: {
    backgroundColor: colors.bg.tertiary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  // ── INDEX BTN ROW (full width, side-by-side) ──
  indexBtnRow: {
    flexDirection: 'row',
    gap: 6,
  },
  optionBtnWide: {
    backgroundColor: colors.bg.tertiary,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    flex: 1,
    alignItems: 'center',
  },
  optionTextWide: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  optionBtnCompact: {
    backgroundColor: colors.bg.tertiary,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
    flex: 1,
    alignItems: 'center',
  },
  optionTextCompact: {
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '700',
  },
  optionText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  // ── LOT CONTROL ──
  lotControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.tertiary,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  lotControlCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.tertiary,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  lotBtn: {
    padding: 8,
  },
  lotBtnCompact: {
    padding: 6,
  },
  lotBtnMini: {
    padding: 5,
  },
  lotText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    minWidth: 36,
    textAlign: 'center',
  },
  lotTextSmall: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    minWidth: 30,
    textAlign: 'center',
  },
  // ── TWO COLUMN ──
  twoColumnRow: {
    flexDirection: 'row',
    gap: spacing.base,
  },
  // ── RISK INPUT ──
  riskInputGroup: {
    flex: 1,
  },
  riskInputLabel: {
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  riskInput: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: 8,
    paddingHorizontal: spacing.base,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  riskInputActive: {
    borderColor: 'rgba(124,92,255,0.3)',
  },
  // ── TRAILING HEADER ROW ──
  trailingHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // ── SUMMARY GRID ──
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryItem: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 8,
    padding: spacing.sm,
    alignItems: 'center',
  },
  summaryLabel: {
    color: colors.text.secondary,
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  // ── ACTIONS ──
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124,92,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  previewBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  deleteBtn: {
    padding: 8,
    backgroundColor: 'rgba(255,51,68,0.1)',
    borderRadius: 6,
  },
  // ── BUY SLOT ──
  needMoreCard: {
    marginTop: spacing.base,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,176,32,0.25)',
    overflow: 'hidden',
  },
  needMoreContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    gap: spacing.sm,
  },
  needMoreIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,176,32,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  needMoreTitle: {
    color: '#FFB020',
    fontWeight: '800',
    fontSize: 13,
  },
  needMoreBody: {
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  buyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFB020',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buyBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 13,
  },
});
