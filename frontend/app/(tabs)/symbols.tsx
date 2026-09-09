import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Heading } from '../../src/components/Primitives';
import { colors, spacing, radius } from '../../src/lib/theme';
import { api } from '../../src/lib/api';
import { Storage } from '../../src/lib/storage';
import AutoSymbolsEntry from '../../src/components/AutoSymbolsEntry';

const AutoSymbolsComponent: any = AutoSymbolsEntry;

function isRenderableComponent(c: any): boolean {
  if (!c) return false;
  return typeof c === 'function' || !!(c.render || c.$$typeof);
}

const INDICES = ['ALL', 'NIFTY', 'BANKNIFTY', 'SENSEX'];
const OPT_TYPES = ['ALL', 'CE', 'PE'];

type Inst = {
  tradingSymbol: string;
  displaySymbol?: string;
  securityId: string;
  strike: number;
  expiry: string;
  optionType: string;
  lot: number;
  exchange: string;
  index: string;
};

export default function SymbolsTab() {
  const insets = useSafeAreaInsets();
  const [downloading, setDownloading] = useState(false);

  const [bundle, setBundle] = useState<{ NIFTY: Inst[]; BANKNIFTY: Inst[]; SENSEX: Inst[] } | null>(null);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [idx, setIdx] = useState('ALL');
  const [opt, setOpt] = useState('ALL');
  const [userSymbols, setUserSymbols] = useState<any[]>([]);
  const [tab, setTab] = useState<'Manual' | 'Auto'>('Auto');

  // Load cached (chunked)
  useEffect(() => {
    (async () => {
      const cached = await Storage.getInstrumentsChunked();
      if (cached?.data) {
        setBundle(cached.data);
        setTotal(cached.total);
      }
      // Load user-saved symbols
      try {
        const r: any = await api.getSymbols();
        const arr = r?.symbols || r?.data || [];
        setUserSymbols(Array.isArray(arr) ? arr : []);
      } catch {}
    })();
  }, []);

  const download = async () => {
    setDownloading(true);
    try {
      const r: any = await api.downloadSymbolsCSV(true);
      if (r?.success) {
        setBundle(r.instruments);
        setTotal(r.total);
        // Cached by api.downloadSymbolsCSV()
        Alert.alert(
          'Downloaded',
          `Total: ${r.total.toLocaleString()}\nNIFTY: ${r.counts.NIFTY}\nBANKNIFTY: ${r.counts.BANKNIFTY}\nSENSEX: ${r.counts.SENSEX}`
        );
      } else {
        Alert.alert('Failed', r?.error || 'Download failed');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setDownloading(false);
    }
  };

// Debounced search state
const [debouncedSearch, setDebouncedSearch] = useState('');

// Update search with debounce (150ms delay for fast response)
useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedSearch(search);
  }, 150);
  return () => clearTimeout(timer);
}, [search]);

// Fast search/filter - pre-computed, no expensive function calls
const filtered = useMemo(() => {
  if (!bundle) return [];
  try {
    // Quick check - no filters = no results (show empty until user selects)
    if (!debouncedSearch.trim() && idx === 'ALL' && opt === 'ALL') return [];
    
    // Start with selected index
    let list: Inst[] = [];
    if (idx === 'ALL') {
      // Limit initial list to prevent slow search
      list = [...bundle.NIFTY.slice(0, 2000), ...bundle.BANKNIFTY.slice(0, 1000), ...bundle.SENSEX.slice(0, 500)];
    } else {
      list = (bundle as any)[idx]?.slice(0, 3000) || [];
    }
    
    // Filter by option type first (fast)
    if (opt !== 'ALL') {
      list = list.filter((i) => i.optionType === opt);
    }
    
    // Text search - simple string matching, no formatExpiry calls during search
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      const qNum = parseInt(q); // Try number for strike search
      
      list = list.filter((i) => {
        // Fast search: check fields directly without formatting
        if (i.tradingSymbol?.toLowerCase().includes(q)) return true;
        if (i.displaySymbol?.toLowerCase().includes(q)) return true;
        if (i.index?.toLowerCase().includes(q)) return true;
        if (i.expiry?.toLowerCase().includes(q)) return true;
        if (qNum && i.strike === qNum) return true;
        return false;
      });
    }
    
    // Sort by expiry then strike (fast)
    list = list.sort((a, b) => {
      if (a.expiry && b.expiry && a.expiry !== b.expiry) return a.expiry.localeCompare(b.expiry);
      return a.strike - b.strike;
    });
    
    // Return top 50 results only for fast display
    return list.slice(0, 50);
  } catch (e) {
    console.error('[Symbols] Filter error:', e);
    return [];
  }
}, [bundle, idx, opt, debouncedSearch]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={{ padding: spacing.base, paddingBottom: 0 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
          <Heading variant="h3">Symbols</Heading>
          <View style={{ flexDirection: 'row', backgroundColor: colors.bg.tertiary, borderRadius: 8, padding: 4 }}>
            <TouchableOpacity
              style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: tab === 'Manual' ? '#7C5CFF' : 'transparent' }}
              onPress={() => setTab('Manual')}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: tab === 'Manual' ? '#fff' : colors.text.secondary }}>Manual</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: tab === 'Auto' ? '#7C5CFF' : 'transparent' }}
              onPress={() => setTab('Auto')}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: tab === 'Auto' ? '#fff' : colors.text.secondary }}>Auto</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {tab === 'Manual' ? (
        <>
          <View style={{ padding: spacing.base, paddingTop: 0, paddingBottom: 0 }}>
            {bundle ? (
          <LinearGradient colors={['#053D2C', '#001F12']} style={styles.readyCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="checkmark-circle" size={20} color="#00FF66" />
              <Text style={{ color: '#00FF66', fontWeight: '800', fontSize: 14 }}>
                Instruments ready for trading
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Pill bg="rgba(0,255,102,0.15)" fg="#00FF66" text={`Total: ${total.toLocaleString()}`} />
              <Pill bg="rgba(124,92,255,0.18)" fg="#7C5CFF" text={`Filtered: ${filtered.length}`} />
            </View>
            <Text style={{ color: 'rgba(0,255,102,0.7)', fontSize: 11, marginTop: 8 }}>
              ✓ Stored locally on device
            </Text>
          </LinearGradient>
        ) : (
          <View style={styles.notReadyCard}>
            <Ionicons name="cloud-download-outline" size={32} color="#7C5CFF" />
            <Text style={{ color: '#fff', fontWeight: '700', marginTop: 8 }}>No instruments loaded</Text>
            <Text style={{ color: colors.text.secondary, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
              Download once per week from Dhan (~2MB, NIFTY/BANKNIFTY/SENSEX options)
            </Text>
          </View>
        )}

        <TouchableOpacity onPress={download} disabled={downloading} style={styles.dlBtn} testID="download-instruments-button">
          <LinearGradient colors={['#00FFE0', '#7C5CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.dlGrad}>
            {downloading ? (
              <ActivityIndicator color="#050505" />
            ) : (
              <>
                <Ionicons name="cloud-download" size={18} color="#050505" />
                <Text style={{ color: '#050505', fontWeight: '800' }}>
                  {bundle ? 'Refresh Instruments' : 'Download Instruments'}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Filters */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.base }}>
          <FilterDropdown label="Index" value={idx} options={INDICES} onChange={setIdx} />
          <FilterDropdown label="Option Type" value={opt} options={OPT_TYPES} onChange={setOpt} />
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={colors.text.secondary} />
          <TextInput
            placeholder="Search by symbol or strike..."
            placeholderTextColor={colors.text.disabled}
            value={search}
            onChangeText={setSearch}
            style={styles.search}
          />
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(i, k) => i.securityId + k}
contentContainerStyle={{ padding: spacing.base, paddingBottom: insets.bottom + 81 }}
        ListHeaderComponent={
          userSymbols.length ? (
            <LinearGradient colors={['#053D2C', '#001F12']} style={styles.activeBlock}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Ionicons name="checkmark-circle" size={16} color="#00FF66" />
                <Text style={{ color: '#00FF66', fontWeight: '900', fontSize: 12, letterSpacing: 1 }}>
                  ✓ YOUR ACTIVE SYMBOLS ({userSymbols.length})
                </Text>
              </View>
              {userSymbols.map((s, i) => (
                <UserSymRow
                  key={s.id || i}
                  sym={s}
                  onDelete={async () => {
                    Alert.alert('Remove symbol', `Remove ${s.symbol_name || s.name} from auto-trading?`, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove', style: 'destructive', onPress: async () => {
                          try {
                            const remaining = userSymbols.filter((x: any) => (x.id || x.symbol_id) !== (s.id || s.symbol_id));
                            await api.saveSymbols(remaining);
                            setUserSymbols(remaining);
                          } catch (e: any) { Alert.alert('Failed', e.message); }
                        }
                      }
                    ]);
                  }}
                />
              ))}
              <Text style={{ color: 'rgba(0,255,102,0.6)', fontSize: 10, textAlign: 'center', marginTop: 4 }}>
                Auto-trade enabled · Synced with website
              </Text>
            </LinearGradient>
          ) : (
            <View style={styles.noActive}>
              <Ionicons name="bookmark-outline" size={20} color={colors.text.disabled} />
              <Text style={{ color: colors.text.secondary, fontSize: 12, marginLeft: 8 }}>
                No active symbols yet — Add from below ↓
              </Text>
            </View>
          )
        }
        ListEmptyComponent={
          bundle ? (
            <Text style={{ color: colors.text.secondary, textAlign: 'center', marginTop: 24 }}>
              No matches. Try a different filter or search.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <InstCard
            inst={item}
            onSaved={async () => {
              try {
                const r: any = await api.getSymbols();
                setUserSymbols(r?.symbols || r?.data || []);
              } catch {}
            }}
          />
        )}
      />
        </>
      ) : (
        isRenderableComponent(AutoSymbolsComponent) ? (
          <AutoSymbolsComponent />
        ) : (
          <View style={{ padding: spacing.base }}>
            <Text style={{ color: colors.text.secondary, textAlign: 'center' }}>
              AutoSymbols failed to load
            </Text>
          </View>
        )
      )}
    </SafeAreaView>
  );
}

function FilterDropdown({ label, value, options, onChange }: any) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: colors.text.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 4 }}>
        {label}
      </Text>
      <TouchableOpacity onPress={() => setOpen(!open)} style={styles.dd}>
        <Text style={{ color: '#fff', fontSize: 14 }}>{value}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.text.secondary} />
      </TouchableOpacity>
      {open && (
        <View style={styles.ddMenu}>
          {options.map((o: string) => (
            <TouchableOpacity
              key={o}
              onPress={() => {
                onChange(o);
                setOpen(false);
              }}
              style={styles.ddItem}
            >
              <Text style={{ color: o === value ? '#00FFE0' : '#fff', fontSize: 13 }}>{o}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function Pill({ bg, fg, text }: any) {
  return (
    <View style={{ backgroundColor: bg, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6 }}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: '800' }}>{text}</Text>
    </View>
  );
}

function InstCard({ inst, onSaved }: { inst: Inst; onSaved: () => void }) {
  const isCall = inst.optionType === 'CE';
  const accent = isCall ? '#00FF66' : '#FF3344';
  const [qty, setQty] = useState(inst.lot || 1);
  const [target, setTarget] = useState('3000');
  const [sl, setSl] = useState('2000');
  const [trail, setTrail] = useState(false);
  const [trailActivate, setTrailActivate] = useState('100');
  const [trailTarget, setTrailTarget] = useState('50');
  const [trailSL, setTrailSL] = useState('50');
  const [saving, setSaving] = useState(false);

  const apiSymbol = `${inst.index}-${formatExpiry(inst.expiry)}-${inst.strike}-${inst.optionType}`;

  const lots = Math.max(1, Math.floor(qty / inst.lot));
  const dec = () => setQty(Math.max(inst.lot, qty - inst.lot));
  const inc = () => setQty(qty + inst.lot);

// Normalize expiry date to YYYY-MM-DD to avoid timezone issues
  const normalizeExpiry = (d: string): string => {
    if (!d || !d.includes('-')) return d;
    // Already in YYYY-MM-DD format - return as-is
    const [y, m, day] = d.split('-');
    if (y && m && day && y.length === 4) {
      return `${y}-${m}-${day}`;
    }
    return d;
  };

  const save = async () => {
    setSaving(true);
    try {
      // DEBUG: Log selected instrument details
      console.log('[DEBUG] Selected instrument:', {
        tradingSymbol: inst.tradingSymbol,
        securityId: inst.securityId,
        strike: inst.strike,
        expiry: inst.expiry,
        optionType: inst.optionType,
        index: inst.index,
        exchange: inst.exchange,
        lot: inst.lot,
      });

      // Validate: check that the instrument has all required fields
      if (!inst.securityId || !inst.expiry) {
        Alert.alert('Error', 'Invalid instrument data. Please refresh symbols and try again.');
        setSaving(false);
        return;
      }

      // Normalize expiry for consistency
      const normalizedExpiry = normalizeExpiry(inst.expiry);
      console.log('[DEBUG] Normalized expiry:', normalizedExpiry);

      // Get existing then append (server's /symbols/save replaces all)
      let existing: any[] = [];
      try {
        const r: any = await api.getSymbols();
        existing = r?.symbols || r?.data || [];
      } catch {}

      // Normalize existing symbols: server returns snake_case at top level
      // AND a `raw_data` blob containing the original camelCase payload.
      // We MUST merge both layers, otherwise re-saving drops optionType/target/SL/trailing
      // and corrupts previously-saved symbols (CE → UNKNOWN/PE bug).
      const normalized = existing.map((s: any) => {
        const r = s.raw_data || {};
        // optionType resolution priority: top-level → snake → raw_data → derive from name
        let optType =
          s.optionType || s.option_type || r.optionType || r.option_type || '';
        if (!optType) {
          const n = (s.symbol_name || s.name || r.name || '').toUpperCase();
          if (n.endsWith('-CE') || n.includes('-CE-')) optType = 'CE';
          else if (n.endsWith('-PE') || n.includes('-PE-')) optType = 'PE';
        }
        optType = String(optType).toUpperCase();
        const idx = s.index || r.index || (s.symbol_name || s.name || '').split('-')[0] || '';
        const secId = s.securityId || s.symbol || r.securityId || r.symbol || '';
        return {
          id: s.id || s.symbol_id || r.id || `sym_${Math.random().toString(36).slice(2)}`,
          symbol_id: s.symbol_id || s.id || r.symbol_id || r.id,
          name: s.name || s.symbol_name || r.name || r.symbol_name || r.tradingSymbol || '',
          symbol_name: s.symbol_name || s.name || r.symbol_name || r.name || r.tradingSymbol || '',
          symbol: secId,
          securityId: secId,
          index: idx,
          exchangeSegment: s.exchangeSegment || s.exchange_segment || r.exchangeSegment || r.exchange_segment || 'NSE_FNO',
          exchange_segment: s.exchange_segment || s.exchangeSegment || r.exchange_segment || r.exchangeSegment || 'NSE_FNO',
          tradingSymbol: s.tradingSymbol || r.tradingSymbol || s.symbol_name || s.name || '',
          optionType: optType,
          option_type: optType,
          strike: s.strike || s.strike_price || r.strike || r.strike_price || 0,
          strike_price: s.strike_price || s.strike || r.strike_price || r.strike || 0,
          expiry: s.expiry || r.expiry || '',
          quantity: s.quantity || s.lot_size || s.lot || r.quantity || r.lot_size || r.lot || 0,
          lot: s.lot || s.lot_size || r.lot || r.lot_size || s.quantity || 1,
          lot_size: s.lot_size || s.lot || r.lot_size || r.lot || s.quantity || 1,
          targetAmount: s.targetAmount ?? s.target_amount ?? r.targetAmount ?? r.target_amount ?? 0,
          stopLossAmount: s.stopLossAmount ?? s.stop_loss_amount ?? r.stopLossAmount ?? r.stop_loss_amount ?? 0,
          trailingEnabled: s.trailingEnabled ?? s.trailing_enabled ?? r.trailingEnabled ?? r.trailing_enabled ?? false,
          trailingActivationAmount: s.trailingActivationAmount ?? s.trailing_activation_amount ?? r.trailingActivationAmount ?? r.trailing_activation_amount ?? 0,
          targetJumpAmount: s.targetJumpAmount ?? s.target_jump_amount ?? r.targetJumpAmount ?? r.target_jump_amount ?? 0,
          stopLossJumpAmount: s.stopLossJumpAmount ?? s.stop_loss_jump_amount ?? r.stopLossJumpAmount ?? r.stop_loss_jump_amount ?? 0,
          active: s.active ?? r.active ?? true,
          autoTrade: s.autoTrade ?? s.auto_trade ?? r.autoTrade ?? r.auto_trade ?? true,
        };
      });

      // Build the new symbol with EXACT fields from selected instrument
      const newSym = {
        id: `sym_${Date.now()}`,
        symbol_id: inst.securityId, // Use exact Dhan securityId as symbol_id
        name: apiSymbol,
        symbol_name: apiSymbol,
        symbol: inst.securityId,
        securityId: inst.securityId,
        index: inst.index,
        exchangeSegment: inst.exchange,
        exchange_segment: inst.exchange,
        tradingSymbol: inst.tradingSymbol,
        optionType: inst.optionType,
        option_type: inst.optionType,
        strike: inst.strike,
        strike_price: inst.strike,
        expiry: normalizedExpiry,
        quantity: qty,
        lot: inst.lot,
        lot_size: inst.lot,
        targetAmount: parseFloat(target) || 0,
        stopLossAmount: parseFloat(sl) || 0,
        trailingEnabled: trail,
        trailingActivationAmount: trail ? parseFloat(trailActivate) || 0 : 0,
        targetJumpAmount: trail ? parseFloat(trailTarget) || 0 : 0,
        stopLossJumpAmount: trail ? parseFloat(trailSL) || 0 : 0,
        active: true,
        autoTrade: true,
        // CRITICAL: Save complete raw instrument data for verification and traceability
        raw_data: {
          tradingSymbol: inst.tradingSymbol,
          displaySymbol: inst.displaySymbol || inst.tradingSymbol,
          securityId: inst.securityId,
          strike: inst.strike,
          expiry: normalizedExpiry,
          optionType: inst.optionType,
          lot: inst.lot,
          exchange: inst.exchange,
          index: inst.index,
          // Store original values from Dhan CSV
          originalExpiry: inst.expiry,
          // Add metadata
          savedAt: new Date().toISOString(),
        },
      };

      console.log('[DEBUG] Saving user_symbols payload:', {
        symbol_id: newSym.symbol_id,
        securityId: newSym.securityId,
        symbol_name: newSym.symbol_name,
        expiry: newSym.expiry,
        strike_price: newSym.strike_price,
        option_type: newSym.option_type,
      });

      // Dedup by securityId AND expiry to ensure exact match
      // This prevents saving wrong expiry when same strike has multiple expiry dates
      const merged = [
        ...normalized.filter((x: any) =>
          x.name !== apiSymbol &&
          x.symbol_name !== apiSymbol &&
          // Check both securityId AND expiry to avoid duplicates with different expiries
          !((x.securityId === inst.securityId || x.symbol === inst.securityId) && x.expiry === normalizedExpiry)
        ),
        newSym,
      ];

      console.log('[DEBUG] Total symbols after merge:', merged.length);

      await api.saveSymbols(merged);
      Alert.alert('Added', `${apiSymbol}\nExpiry: ${normalizedExpiry}\nSecurityID: ${inst.securityId}\nsaved to trading list`);
      onSaved();
    } catch (e: any) {
      console.error('[DEBUG] Save error:', e);
      Alert.alert('Failed', e.message);
    } finally {
      setSaving(false);
    }
  };

// Format display like CSV: "NIFTY 05 MAY 25500 CALL"
  const displayName = inst.tradingSymbol || `${inst.index} ${formatExpiry(inst.expiry).replace(',',' ')} ${inst.strike} ${isCall ? 'CALL' : 'PUT'}`;

  return (
    <View style={[styles.instCard, { borderColor: accent + '55' }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, flex: 1 }}>
          {displayName}
        </Text>
        <View style={{ backgroundColor: 'rgba(124,92,255,0.18)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}>
          <Text style={{ color: '#7C5CFF', fontSize: 10, fontWeight: '800' }}>{inst.index}</Text>
        </View>
        <View style={{ backgroundColor: accent + '22', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}>
          <Text style={{ color: accent, fontSize: 10, fontWeight: '800' }}>{inst.optionType}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View>
          <Text style={styles.metaText}>Strike: <Text style={{ color: '#fff' }}>{inst.strike}</Text></Text>
          <Text style={styles.metaText}>Expiry: <Text style={{ color: '#fff' }}>{inst.expiry}</Text></Text>
          <Text style={[styles.metaText, { fontFamily: 'monospace' }]}>API: <Text style={{ color: colors.text.disabled }}>{apiSymbol}</Text></Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: colors.text.secondary, fontSize: 11 }}>Lot:</Text>
          <Text style={{ color: '#00FF66', fontWeight: '800', fontSize: 16 }}>{inst.lot}</Text>
        </View>
      </View>

      {/* Quantity stepper */}
      <View style={{ marginTop: 10 }}>
        <Text style={styles.fieldLabel}>📦 Quantity</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <TouchableOpacity onPress={dec} style={styles.qtyBtn}><Text style={{ color: '#fff', fontSize: 18 }}>−</Text></TouchableOpacity>
          <View style={styles.qtyBox}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{qty}</Text>
          </View>
          <TouchableOpacity onPress={inc} style={[styles.qtyBtn, { borderColor: '#00FF66' }]}>
            <Text style={{ color: '#00FF66', fontSize: 18 }}>+</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.text.secondary, fontSize: 11 }}>({lots} lots)</Text>
        </View>
      </View>

      {/* Target / SL */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.fieldLabel, { color: '#00FF66' }]}>🎯 Target (₹)</Text>
          <TextInput keyboardType="number-pad" value={target} onChangeText={setTarget} style={[styles.inputField, { borderColor: '#00FF6655' }]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.fieldLabel, { color: '#FF3344' }]}>🛑 Stop Loss (₹)</Text>
          <TextInput keyboardType="number-pad" value={sl} onChangeText={setSl} style={[styles.inputField, { borderColor: '#FF334455' }]} />
        </View>
      </View>

      {/* Trailing SL */}
      <View style={styles.trailRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <Ionicons name="flash" size={14} color="#7C5CFF" />
          <Text style={{ color: '#7C5CFF', fontWeight: '700', fontSize: 13 }}>Trailing Stop Loss</Text>
        </View>
        <Switch value={trail} onValueChange={setTrail} trackColor={{ true: '#7C5CFF', false: '#333' }} thumbColor="#fff" />
      </View>

      {trail && (
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fieldLabel, { color: '#FFD700' }]}>💰 Activate @</Text>
            <TextInput
              keyboardType="number-pad"
              value={trailActivate}
              onChangeText={setTrailActivate}
              style={[styles.inputField, { borderColor: '#FFD70066' }]}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fieldLabel, { color: '#00FF66' }]}>📈 Target +</Text>
            <TextInput
              keyboardType="number-pad"
              value={trailTarget}
              onChangeText={setTrailTarget}
              style={[styles.inputField, { borderColor: '#00FF6655' }]}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fieldLabel, { color: '#FF7A00' }]}>🔻 SL −</Text>
            <TextInput
              keyboardType="number-pad"
              value={trailSL}
              onChangeText={setTrailSL}
              style={[styles.inputField, { borderColor: '#FF7A0055' }]}
            />
          </View>
        </View>
      )}

      <TouchableOpacity onPress={save} disabled={saving} style={[styles.addBtn, { backgroundColor: accent }]}>
        {saving ? (
          <ActivityIndicator color="#050505" />
        ) : (
          <>
            <Ionicons name="add" size={18} color="#050505" />
            <Text style={{ color: '#050505', fontWeight: '800', fontSize: 14 }}>Add to Trading</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

function UserSymRow({ sym, onDelete }: { sym: any; onDelete?: () => void }) {
  // Server returns: { symbol_name, option_type, lot_size, strike_price, expiry, raw_data: {...} }
  const name = sym.symbol_name || sym.name || sym.tradingSymbol || 'Unknown';
  const optType = (sym.option_type || sym.optionType || (sym.raw_data?.optionType) || '').toUpperCase();
  const isCall = optType === 'CE';
  const color = isCall ? '#00FF66' : '#FF3344';
  const qty = sym.quantity || sym.lot_size || (sym.raw_data?.quantity) || 0;
  const target = sym.targetAmount || (sym.raw_data?.targetAmount) || (sym.raw_data?.raw_data?.targetAmount) || 0;
  const sl = sym.stopLossAmount || (sym.raw_data?.stopLossAmount) || (sym.raw_data?.raw_data?.stopLossAmount) || 0;
  const trail = sym.trailingEnabled || (sym.raw_data?.trailingEnabled) || false;

  return (
    <View style={[styles.userRow, { borderLeftColor: color }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }} numberOfLines={1}>
          {name}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 }}>
          Qty {qty} • T ₹{target} • SL ₹{sl}{trail ? ' • Trail' : ''}
        </Text>
      </View>
      <View style={{ backgroundColor: color + '33', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginRight: 6 }}>
        <Text style={{ color, fontSize: 10, fontWeight: '900' }}>{isCall ? 'CALL' : 'PUT'}</Text>
      </View>
      {onDelete ? (
        <TouchableOpacity onPress={onDelete} style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: 'rgba(255,51,68,0.12)' }}>
          <Ionicons name="trash-outline" size={14} color="#FF3344" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// Utility functions for consistent formatting across the app
export function formatExpiry(d: string): string {
  // 2026-05-05 → May05,2026 (show day for clarity)
  if (!d || !d.includes('-')) return d;
  const parts = d.split('-');
  if (parts.length >= 2) {
    const y = parts[0];
    const m = parts[1];
    const day = parts[2]?.padStart(2, '0') || '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return day ? `${months[parseInt(m) - 1]}${day},${y}` : `${months[parseInt(m) - 1]}${y}`;
  }
  return d;
}

export function formatExpiryForSearch(d: string): string {
  // 2026-05-05 → may05 (lowercase for search matching)
  if (!d || !d.includes('-')) return d;
  const parts = d.split('-');
  const m = parts[1];
  const day = parts[2]?.padStart(2, '0') || '';
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  return day ? `${months[parseInt(m) - 1]}${day}` : `${months[parseInt(m) - 1]}${parts[0].slice(2)}`;
}

export function getDisplayName(inst: any): string {
  // Format: "NIFTY 05 MAY 25500 CALL"
  const isCall = inst.optionType === 'CE';
  return inst.tradingSymbol || 
    `${inst.index} ${formatExpiry(inst.expiry).replace(',', ' ')} ${inst.strike} ${isCall ? 'CALL' : 'PUT'}`;
}

export function getApiSymbol(inst: any): string {
  // Format: "NIFTY-May05,2026-25500-CE" for trading API
  return `${inst.index}-${formatExpiry(inst.expiry)}-${inst.strike}-${inst.optionType}`;
}

export function matchesSearch(inst: any, query: string): boolean {
  // Flexible search matching for multiple fields
  const q = query.toLowerCase();
  const searchIn = [
    inst.tradingSymbol,
    inst.displaySymbol,
    inst.index,
    String(inst.strike),
    formatExpiry(inst.expiry).toLowerCase(),
    formatExpiryForSearch(inst.expiry),
    inst.expiry,
  ].join(' ').toLowerCase();
  return searchIn.includes(q);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  readyCard: {
    padding: spacing.base,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#00FF6655',
  },
  notReadyCard: {
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
  },
  dlBtn: { marginTop: spacing.base, borderRadius: radius.sm, overflow: 'hidden' },
  dlGrad: {
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dd: {
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: 'rgba(124,92,255,0.4)',
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ddMenu: {
    position: 'absolute',
    top: 64,
    left: 0,
    right: 0,
    backgroundColor: colors.bg.tertiary,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border.default,
    zIndex: 10,
  },
  ddItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: colors.border.default },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(124,92,255,0.4)',
    marginTop: spacing.sm,
  },
  search: { flex: 1, color: '#fff', paddingVertical: 12, fontSize: 14 },
  section: {
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  instCard: {
    backgroundColor: '#0A0820',
    borderRadius: radius.md,
    padding: spacing.base,
    marginBottom: spacing.base,
    borderWidth: 1,
  },
  metaText: { color: colors.text.secondary, fontSize: 11, marginVertical: 1 },
  fieldLabel: { color: colors.text.secondary, fontSize: 11, fontWeight: '700' },
  qtyBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBox: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputField: {
    backgroundColor: '#000',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  trailRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124,92,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(124,92,255,0.25)',
  },
  addBtn: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  userRow: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: spacing.sm + 2,
    borderRadius: radius.sm,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 3,
  },
  activeBlock: {
    padding: spacing.base,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#00FF6655',
    marginBottom: spacing.lg,
  },
  noActive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.secondary,
    padding: spacing.base,
    borderRadius: radius.md,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderStyle: 'dashed',
  },
});
