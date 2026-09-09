import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import RazorpayModal, { RazorpayOrder } from './RazorpayModal';
import { api } from '../lib/api';
import { colors, spacing, radius } from '../lib/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void; // refresh wallet
  user?: { name?: string; email?: string; phone?: string };
};

const QUICK = [500, 1000, 2000, 5000, 10000, 25000];

export default function AddFundsModal({ visible, onClose, onSuccess, user }: Props) {
  const [amount, setAmount] = useState<string>('1000');
  const [creating, setCreating] = useState(false);
  const [order, setOrder] = useState<RazorpayOrder | null>(null);
  const [verifying, setVerifying] = useState(false);

  const startPayment = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt < 1) {
      Alert.alert('Invalid amount', 'Please enter an amount of at least ₹1');
      return;
    }
    if (amt > 200000) {
      Alert.alert('Limit exceeded', 'Maximum recharge per transaction is ₹2,00,000');
      return;
    }
    setCreating(true);
    try {
      const r: any = await api.createRecharge(amt);
      // Backend returns: { success, order: { id, amount, currency, ... }, razorpayKeyId }
      const orderObj = r?.order || r?.data?.order || r;
      const orderId = orderObj?.id || r?.orderId || r?.order_id || r?.razorpayOrderId;
      const keyId = r?.razorpayKeyId || r?.keyId || r?.key_id || r?.data?.razorpayKeyId || 'rzp_live_SGiyfm4tpOcn21';
      const amtPaise = orderObj?.amount || r?.amount || amt * 100;
      if (!orderId) {
        Alert.alert('Order failed', r?.error || r?.message || 'Could not create payment order');
        setCreating(false);
        return;
      }
      setOrder({
        orderId,
        keyId,
        amount: amtPaise,
        currency: orderObj?.currency || 'INR',
        name: 'IndexPilot AI',
        description: `Wallet Recharge ₹${amt}`,
        prefill: { name: user?.name, email: user?.email, contact: user?.phone },
        themeColor: '#7C5CFF',
      });
    } catch (e: any) {
      Alert.alert('Payment error', e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleSuccess = async (resp: any) => {
    setOrder(null);
    setVerifying(true);
    try {
      const v: any = await api.verifyRecharge({
        razorpay_payment_id: resp.razorpay_payment_id,
        razorpay_order_id: resp.razorpay_order_id,
        razorpay_signature: resp.razorpay_signature,
        amount: parseFloat(amount),
      });
      if (v?.success !== false) {
        Alert.alert('Success! 🎉', `₹${amount} added to your wallet`, [
          { text: 'OK', onPress: () => { onSuccess(); onClose(); } },
        ]);
      } else {
        Alert.alert('Verification pending', v?.message || 'Payment received, ledger update may take a moment.');
        onSuccess();
      }
    } catch (e: any) {
      Alert.alert('Verification failed', e.message + '\nPayment may still be processed. Please refresh wallet.');
    } finally {
      setVerifying(false);
    }
  };

  const handleFailure = (err: any) => {
    setOrder(null);
    Alert.alert('Payment cancelled', err?.description || err?.message || 'You can try again anytime.');
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <SafeAreaView style={styles.container} edges={['top']}>
          <LinearGradient colors={['#0A0820', '#000']} style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title}>Add Funds</Text>
            <View style={{ width: 36 }} />
          </LinearGradient>

          <ScrollView contentContainerStyle={{ padding: spacing.base, paddingBottom: 80 }}>
            {/* Hero */}
            <LinearGradient colors={['#00B4FF', '#7C5CFF', '#FF4DD2']} style={styles.hero}>
              <View style={styles.heroInner}>
                <Text style={styles.heroLabel}>RECHARGE WALLET</Text>
                <Text style={styles.heroAmount}>
                  ₹{(parseFloat(amount) || 0).toLocaleString('en-IN')}
                </Text>
                <Text style={styles.heroSub}>Instant credit · 100% secure</Text>
              </View>
            </LinearGradient>

            {/* Custom amount */}
            <Text style={styles.label}>ENTER AMOUNT</Text>
            <View style={styles.inputWrap}>
              <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900', marginRight: 8 }}>₹</Text>
              <TextInput
                value={amount}
                onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.text.disabled}
                style={styles.input}
                maxLength={6}
              />
            </View>

            {/* Quick picks */}
            <Text style={[styles.label, { marginTop: spacing.lg }]}>QUICK SELECT</Text>
            <View style={styles.quickGrid}>
              {QUICK.map((q) => {
                const sel = parseFloat(amount) === q;
                return (
                  <TouchableOpacity
                    key={q}
                    onPress={() => setAmount(String(q))}
                    style={[styles.quickBtn, sel && styles.quickBtnSel]}
                  >
                    <Text style={[styles.quickText, sel && styles.quickTextSel]}>
                      ₹{q.toLocaleString('en-IN')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Methods info */}
            <View style={styles.methodsCard}>
              <Text style={{ color: colors.text.secondary, fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>
                ACCEPTED PAYMENT METHODS
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {['UPI', 'Cards', 'NetBanking', 'Wallets', 'EMI'].map((m) => (
                  <View key={m} style={styles.chip}>
                    <Ionicons name="checkmark-circle" size={11} color="#00FF66" />
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{m}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Pay button */}
            <TouchableOpacity
              onPress={startPayment}
              disabled={creating || verifying || !parseFloat(amount)}
              style={{ marginTop: spacing.lg }}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#00FFE0', '#7C5CFF', '#FF4DD2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.payBtn}
              >
                {creating || verifying ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <Ionicons name="lock-closed" size={16} color="#000" />
                    <Text style={styles.payText}>
                      Pay ₹{(parseFloat(amount) || 0).toLocaleString('en-IN')} Securely
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <Text style={{ color: colors.text.disabled, fontSize: 10, textAlign: 'center', marginTop: 12 }}>
              🔒 Powered by Razorpay · PCI DSS Level 1 compliant
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <RazorpayModal
        visible={!!order}
        order={order}
        onSuccess={handleSuccess}
        onFailure={handleFailure}
        onClose={() => setOrder(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: '#fff', fontSize: 16, fontWeight: '800' },
  hero: { borderRadius: radius.lg, padding: 1.5 },
  heroInner: { backgroundColor: '#08051F', borderRadius: radius.lg - 1.5, padding: spacing.lg, alignItems: 'center' },
  heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  heroAmount: { color: '#fff', fontSize: 44, fontWeight: '900', marginTop: 8, letterSpacing: -1 },
  heroSub: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 4 },
  label: { color: colors.text.secondary, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginTop: spacing.lg, marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0F0F1A',
    borderRadius: radius.md,
    borderWidth: 1, borderColor: 'rgba(124,92,255,0.4)',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  input: { flex: 1, color: '#fff', fontSize: 32, fontWeight: '900', padding: 8 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickBtn: {
    flexBasis: '31%',
    backgroundColor: '#0F0F1A',
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  quickBtnSel: { backgroundColor: 'rgba(124,92,255,0.15)', borderColor: '#7C5CFF' },
  quickText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  quickTextSel: { color: '#7C5CFF' },
  methodsCard: {
    marginTop: spacing.lg,
    padding: spacing.base,
    backgroundColor: '#0F0F1A',
    borderRadius: radius.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,255,102,0.1)',
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1, borderColor: 'rgba(0,255,102,0.2)',
  },
  payBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, borderRadius: radius.md, gap: 8,
  },
  payText: { color: '#000', fontSize: 15, fontWeight: '900' },
});
