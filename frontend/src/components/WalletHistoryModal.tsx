import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../lib/api';
import { colors, spacing, radius } from '../lib/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
};

type Txn = {
  id?: string;
  type?: string;
  amount?: number;
  status?: string;
  description?: string;
  createdAt?: string;
  created_at?: string;
  method?: string;
  reason?: string;
  reference?: string;
};

export default function WalletHistoryModal({ visible, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [stats, setStats] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [txRes, stRes] = await Promise.allSettled([
        api.getWalletTransactions(),
        api.getWalletDailyStats(),
      ]);
      if (txRes.status === 'fulfilled') {
        const v: any = txRes.value;
        const list = v?.transactions || v?.data || v?.items || (Array.isArray(v) ? v : []);
        setTxns(Array.isArray(list) ? list : []);
      }
      if (stRes.status === 'fulfilled') setStats(stRes.value);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) load();
  }, [visible]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <LinearGradient colors={['#0a0a0a', '#000']} style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Wallet History</Text>
          <TouchableOpacity onPress={load} style={styles.closeBtn}>
            <Ionicons name="refresh" size={18} color="#fff" />
          </TouchableOpacity>
        </LinearGradient>

        {/* Daily stats card */}
        {stats ? (
          <LinearGradient colors={['#0F1A3D', '#1A0F3D']} style={styles.statsCard}>
            <Text style={styles.statsLabel}>TODAY'S USAGE</Text>
            <View style={{ flexDirection: 'row', marginTop: 8 }}>
              <Stat label="Spent" value={stats?.spent || stats?.totalSpent || 0} color="#FF7A00" />
              <Stat label="Recharged" value={stats?.recharged || stats?.totalRecharged || 0} color="#00FF66" />
              <Stat label="Trades" value={stats?.tradesCount || stats?.trades || 0} color="#7C5CFF" rupee={false} />
            </View>
          </LinearGradient>
        ) : null}

        {loading && !txns.length ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#7C5CFF" size="large" />
            <Text style={{ color: colors.text.secondary, marginTop: 12, fontSize: 12 }}>Loading transactions…</Text>
          </View>
        ) : (
          <FlatList
            data={txns}
            keyExtractor={(it, i) => String(it.id || it.reference || i)}
            contentContainerStyle={{ padding: spacing.base, paddingBottom: 80 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                <Ionicons name="receipt-outline" size={56} color={colors.text.disabled} />
                <Text style={{ color: colors.text.secondary, marginTop: 12, fontSize: 13 }}>No transactions yet</Text>
                <Text style={{ color: colors.text.disabled, fontSize: 11, marginTop: 4 }}>Add funds to get started</Text>
              </View>
            }
            renderItem={({ item }) => <TxnRow tx={item} />}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

function Stat({ label, value, color, rupee = true }: { label: string; value: number; color: string; rupee?: boolean }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '700', letterSpacing: 1 }}>{label}</Text>
      <Text style={{ color, fontSize: 16, fontWeight: '900', marginTop: 4, fontVariant: ['tabular-nums'] }}>
        {rupee ? '₹' : ''}{Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
      </Text>
    </View>
  );
}

function TxnRow({ tx }: { tx: Txn }) {
  const typeStr = String(tx.type || '').toLowerCase();
  // Explicit type wins. Only positive amount fallback if no type given.
  const isCredit = typeStr === 'credit' || typeStr.includes('recharge') || typeStr.includes('deposit') || typeStr === 'add'
    || (!typeStr && Number(tx.amount) > 0);
  const isDebit = typeStr === 'debit' || typeStr.includes('withdraw') || typeStr.includes('fee') || typeStr === 'deduct';
  const credit = isCredit && !isDebit;
  const amount = Math.abs(Number(tx.amount || 0));
  const status = (tx.status || 'success').toLowerCase();
  const icon = credit ? 'arrow-down-circle' : 'arrow-up-circle';
  const color = credit ? '#00FF66' : '#FF7A00';
  const date = tx.createdAt || tx.created_at || (tx as any).timestamp;
  const dateStr = date ? new Date(date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  const statusColor = status === 'success' || status === 'completed' || status === 'paid' ? '#00FF66' : status === 'pending' ? '#FFB800' : '#FF3344';

  return (
    <View style={[styles.txnRow, { borderLeftColor: color }]}>
      <View style={[styles.txIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }} numberOfLines={2}>
          {tx.description || tx.reason || (credit ? 'Wallet Recharge' : 'Trade Debit')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 8 }}>
          <Text style={{ color: colors.text.secondary, fontSize: 11 }}>{dateStr}</Text>
          <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: colors.text.disabled }} />
          <Text style={{ color: statusColor, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>{credit ? 'CREDIT' : 'DEBIT'}</Text>
        </View>
      </View>
      <Text style={{ color, fontWeight: '900', fontSize: 15, fontVariant: ['tabular-nums'] }}>
        {credit ? '+' : '−'}₹{amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: '#fff', fontSize: 16, fontWeight: '800' },
  statsCard: {
    margin: spacing.base,
    padding: spacing.base,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(124,92,255,0.3)',
  },
  statsLabel: { color: '#7C5CFF', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F0F1A',
    borderLeftWidth: 3,
    borderRadius: radius.md,
    padding: spacing.base,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  txIcon: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
});
