import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  AppState,
  AppStateStatus,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Card, Button, Body, Heading } from './Primitives';
import { colors, spacing, radius, typography } from '../lib/theme';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import RazorpayModal, { RazorpayOrder } from './RazorpayModal';
import AddFundsModal from './AddFundsModal';

const VPS_PRICE = 599;
const POLL_INTERVAL = 3000;

type Assignment = {
  ipAddress?: string;
  provider?: string;
  assignedAt?: string;
  subscriptionStatus?: string;
  expiresAt?: string;
  monthlyFee?: number;
  daysRemaining?: number;
};

type ProvisioningJob = {
  status: string;
  ipAddress?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  estimatedMinutes?: number;
  error?: string | null;
};

type Props = {
  onRefreshWallet?: () => void;
};

function daysUntil(expiresAt?: string): number {
  if (!expiresAt) return 0;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
}

function calcProgress(status: string, startedAt?: string | null, estimatedMinutes?: number): number {
  if (status === 'ready' || status === 'active') return 100;
  if (status === 'failed') return 0;
  const elapsed = startedAt ? Date.now() - new Date(startedAt).getTime() : 0;
  const est = (estimatedMinutes || 8) * 60000;
  const base = Math.min((elapsed / est) * 90, 90);
  if (status === 'creating') return Math.min(base, 45);
  if (status === 'deploying') return Math.min(45 + base * 0.6, 92);
  return Math.min(base, 10);
}

function statusCopy(status: string): string {
  switch (status) {
    case 'pending': return 'Payment confirmed, initializing server…';
    case 'creating': return 'Please wait, server is being created on DigitalOcean…';
    case 'deploying': return 'Deployment in progress. Installing order execution server…';
    case 'failed': return 'Provisioning failed';
    case 'ready':
    case 'active': return 'Your dedicated VPS is ready!';
    default: return 'Processing…';
  }
}

export default function DedicatedVpsScreen({ onRefreshWallet }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [hasIP, setHasIP] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [job, setJob] = useState<ProvisioningJob | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [razorpayOrder, setRazorpayOrder] = useState<RazorpayOrder | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [vpsPower, setVpsPower] = useState<any>(null);
  const [testingConn, setTestingConn] = useState(false);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef(AppState.currentState);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res: any = await api.getIPStatus();
        if (res?.provisioning && res?.job) {
          setProvisioning(true);
          setJob(res.job);
          if (res.job.status === 'ready' || res.job.status === 'active') {
            stopPolling();
            await refreshAll();
          } else if (res.job.status === 'failed') {
            stopPolling();
            setProvisioning(true);
            setJob(res.job);
          }
        } else if (res?.assignment) {
          stopPolling();
          setProvisioning(false);
          setAssignment(res.assignment);
          setHasIP(true);
        } else {
          stopPolling();
          setProvisioning(false);
        }
      } catch {
        // keep polling
      }
    }, POLL_INTERVAL);
  }, [stopPolling]);

  const refreshAll = useCallback(async () => {
    try {
      const [ipRes, walletRes] = await Promise.all([
        api.getMyIP().catch(() => null),
        api.getWalletBalance().catch(() => null),
      ]);
      if (ipRes?.hasIP && ipRes?.assignment) {
        setHasIP(true);
        setAssignment(ipRes.assignment);
        setProvisioning(false);
      } else if (ipRes?.provisioning) {
        setProvisioning(true);
        setJob(ipRes.job);
        startPolling();
      } else {
        setHasIP(false);
        setAssignment(null);
        setProvisioning(false);
      }
      if (walletRes?.balance !== undefined) setWalletBalance(walletRes.balance);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [startPolling]);

  useEffect(() => {
    refreshAll();
    // Fire activity update on mount
    api.updateUserActivity().catch(() => {});
    return () => stopPolling();
  }, [refreshAll, stopPolling]);

  // Stop polling on background, resume on foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active') {
        refreshAll();
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [refreshAll]);

  const copyIP = async () => {
    const addr = assignment?.ipAddress || job?.ipAddress;
    if (!addr) return;
    try {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(addr);
    } catch {
      try {
        // @ts-ignore
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          // @ts-ignore
          await navigator.clipboard.writeText(addr);
        }
      } catch {}
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const buyWithWallet = async () => {
    setBusy(true);
    try {
      const res: any = await api.subscribeIP();
      if (res?.success) {
        if (res?.isRenewal) {
          Alert.alert('Renewed!', 'Your subscription has been renewed. Your IP is unchanged.');
          await refreshAll();
        } else if (res?.isRecovered) {
          Alert.alert('Recovered!', 'Your existing VPS has been linked.');
          await refreshAll();
        } else if (res?.provisioning) {
          setProvisioning(true);
          setJob({ status: 'pending', estimatedMinutes: res.estimatedMinutes || 8 });
          startPolling();
        } else if (res?.assignment) {
          setHasIP(true);
          setAssignment(res.assignment);
        }
        if (res?.wallet?.balance !== undefined) setWalletBalance(res.wallet.balance);
        if (onRefreshWallet) onRefreshWallet();
      } else {
        Alert.alert('Failed', res?.error || 'Could not process payment');
      }
    } catch (e: any) {
      const msg = e?.message || 'Payment failed';
      if (msg.includes('Insufficient balance')) {
        Alert.alert('Insufficient Balance', msg, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Funds', onPress: () => setShowAddFunds(true) },
        ]);
      } else {
        Alert.alert('Payment Failed', msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const buyWithRazorpay = async () => {
    setBusy(true);
    try {
      const order: any = await api.createIPOrder();
      if (order?.recovered) {
        Alert.alert('Recovered!', order.message || 'Your existing VPS has been linked.');
        await refreshAll();
        return;
      }
      if (!order?.orderId) {
        Alert.alert('Order failed', order?.error || order?.message || 'Could not create payment order');
        return;
      }
      setRazorpayOrder({
        orderId: order.orderId,
        keyId: order.keyId || 'rzp_live_SGiyfm4tpOcn21',
        amount: (order.amount || VPS_PRICE) * 100, // rupees -> paise
        currency: order.currency || 'INR',
        name: 'IndexpilotAI',
        description: order.isRenewal
          ? 'VPS Subscription Renewal (₹599/month)'
          : 'Dedicated VPS — Static IP for Broker (₹599/month)',
        prefill: { email: user?.email },
        themeColor: '#06b6d4',
      });
    } catch (e: any) {
      Alert.alert('Payment error', e?.message || 'Could not create payment order');
    } finally {
      setBusy(false);
    }
  };

  const handleRazorpaySuccess = async (resp: any) => {
    setRazorpayOrder(null);
    setVerifying(true);
    try {
      const verify: any = await api.verifyIPPayment({
        razorpay_order_id: resp.razorpay_order_id,
        razorpay_payment_id: resp.razorpay_payment_id,
        razorpay_signature: resp.razorpay_signature,
      });
      if (verify?.isRenewal) {
        Alert.alert('Renewed!', 'Subscription renewed — your IP is unchanged.');
        await refreshAll();
      } else if (verify?.provisioning) {
        setProvisioning(true);
        setJob({ status: 'pending', estimatedMinutes: verify.estimatedMinutes || 8 });
        startPolling();
      } else if (verify?.assignment) {
        setHasIP(true);
        setAssignment(verify.assignment);
      }
    } catch (e: any) {
      const msg = e?.message || 'Verification failed';
      if (msg.includes('already been processed') || msg.includes('409')) {
        // Duplicate verify - treat as success
        await refreshAll();
      } else if (msg.includes('provisioning failed')) {
        Alert.alert(
          'Payment received',
          'Server creation failed — support has been notified.',
          [
            { text: 'OK' },
            { text: 'Retry', onPress: () => restartProvisioning() },
          ]
        );
      } else {
        Alert.alert(
          'Payment could not be verified',
          'If money was debited it will auto-refund in 5–7 days. Contact support with the payment ID.'
        );
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleRazorpayFailure = (err: any) => {
    setRazorpayOrder(null);
    Alert.alert('Payment cancelled', err?.description || err?.message || 'You can try again anytime.');
  };

  const restartProvisioning = async () => {
    setBusy(true);
    try {
      const res: any = await api.restartIPProvisioning();
      if (res?.success) {
        setProvisioning(true);
        setJob({ status: 'pending', estimatedMinutes: res.estimatedMinutes || 8 });
        startPolling();
      } else {
        Alert.alert('Failed', res?.error || 'Could not restart provisioning');
      }
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Could not restart provisioning');
    } finally {
      setBusy(false);
    }
  };

  const cancelProvisioning = async () => {
    Alert.alert(
      'Cancel provisioning?',
      'This will stop the current provisioning job. No charge will be made.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.cancelIPProvisioning();
              setProvisioning(false);
              setJob(null);
              await refreshAll();
            } catch (e: any) {
              Alert.alert('Failed', e?.message || 'Could not cancel provisioning');
            }
          },
        },
      ]
    );
  };

  const recreateIP = () => {
    Alert.alert(
      'Recreate IP?',
      'This will destroy the current droplet and create a brand-new one. Your IP will change and must be re-whitelisted in your broker. No additional payment is required.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Recreate',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              const res: any = await api.recreateIP();
              if (res?.success) {
                Alert.alert('Recreating…', 'Your new VPS is being created. This may take 8–15 minutes.');
                setProvisioning(true);
                setJob({ status: 'pending', estimatedMinutes: 8 });
                startPolling();
              } else {
                Alert.alert('Failed', res?.error || 'Could not recreate IP');
              }
            } catch (e: any) {
              Alert.alert('Failed', e?.message || 'Could not recreate IP');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const cancelSubscription = () => {
    Alert.alert(
      'Cancel subscription?',
      'This will delete your DigitalOcean droplet and remove all state. You will need to purchase again to get a new IP.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              const res: any = await api.cancelIP();
              if (res?.success) {
                setHasIP(false);
                setAssignment(null);
                setProvisioning(false);
                setJob(null);
                Alert.alert('Cancelled', 'Your subscription has been cancelled.');
              } else {
                Alert.alert('Failed', res?.error || 'Could not cancel subscription');
              }
            } catch (e: any) {
              Alert.alert('Failed', e?.message || 'Could not cancel subscription');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const recoverVPS = async () => {
    setBusy(true);
    try {
      const res: any = await api.recoverIP();
      if (res?.success) {
        if (res?.assignment) {
          setHasIP(true);
          setAssignment(res.assignment);
          Alert.alert('Recovered!', 'Your existing VPS has been linked.');
        } else {
          Alert.alert('No VPS found', 'No existing VPS was found to recover.');
        }
      } else {
        Alert.alert('No VPS found', res?.error || 'No existing VPS was found to recover.');
      }
    } catch (e: any) {
      Alert.alert('No VPS found', e?.message || 'No existing VPS was found to recover.');
    } finally {
      setBusy(false);
    }
  };

  const testConnection = async () => {
    setTestingConn(true);
    try {
      const res: any = await api.testVpsConnectivity();
      if (res?.success || res?.ok) {
        Alert.alert('✅ Connected', 'Your VPS is reachable and healthy.');
      } else {
        Alert.alert('⚠️ Issue', res?.error || res?.message || 'VPS connectivity check failed.');
      }
    } catch (e: any) {
      Alert.alert('⚠️ Issue', e?.message || 'VPS connectivity check failed.');
    } finally {
      setTestingConn(false);
    }
  };

  const loadVpsPower = async () => {
    try {
      const res: any = await api.getVpsPowerStatus();
      if (res?.success) setVpsPower(res);
    } catch {}
  };

  useEffect(() => {
    if (hasIP) loadVpsPower();
  }, [hasIP]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand.primary} />
        <Text style={{ color: colors.text.secondary, marginTop: 12 }}>Loading your VPS status…</Text>
      </View>
    );
  }

  // ─── PROVISIONING STATE ───
  if (provisioning) {
    const status = job?.status || 'pending';
    const progress = calcProgress(status, job?.startedAt, job?.estimatedMinutes);
    const failed = status === 'failed';

    return (
      <ScrollView contentContainerStyle={{ padding: spacing.base, paddingBottom: 80 }}>
        <Card>
          <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
            <View style={styles.progressRing}>
              <ActivityIndicator size="large" color={failed ? colors.trading.loss : colors.brand.primary} />
            </View>
            <Heading variant="h4" style={{ marginTop: spacing.base, textAlign: 'center' }}>
              {failed ? 'Provisioning Failed' : 'Setting up your VPS…'}
            </Heading>
            <Body style={{ textAlign: 'center', marginTop: spacing.sm }}>
              {statusCopy(status)}
            </Body>
          </View>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: failed ? colors.trading.loss : colors.brand.primary }]} />
          </View>
          <Text style={{ color: colors.text.secondary, fontSize: 12, textAlign: 'center', marginTop: spacing.sm }}>
            {Math.round(progress)}%
          </Text>

          {/* Step chips */}
          <View style={styles.stepRow}>
            {[
              { label: '1. Creating VPS', active: status === 'creating' || status === 'deploying' || status === 'ready' || status === 'active' },
              { label: '2. Deploying Server', active: status === 'deploying' || status === 'ready' || status === 'active' },
              { label: '3. Ready!', active: status === 'ready' || status === 'active' },
            ].map((step, i) => (
              <View key={i} style={[styles.stepChip, step.active && styles.stepChipActive]}>
                <Text style={{ color: step.active ? '#050505' : colors.text.secondary, fontSize: 11, fontWeight: '700' }}>
                  {step.label}
                </Text>
              </View>
            ))}
          </View>

          {job?.ipAddress ? (
            <View style={{ marginTop: spacing.base, alignItems: 'center' }}>
              <Text style={{ color: colors.text.secondary, fontSize: 12 }}>Your IP will be:</Text>
              <Text style={{ ...(typography.metric as any), fontSize: 20, color: colors.text.primary, marginTop: 4 }}>
                {job.ipAddress}
              </Text>
            </View>
          ) : null}

          {failed ? (
            <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
              <Button title="Restart provisioning (free)" onPress={restartProvisioning} loading={busy} />
              <Button title="Reset" variant="ghost" onPress={cancelProvisioning} />
            </View>
          ) : (
            <TouchableOpacity onPress={cancelProvisioning} style={{ marginTop: spacing.lg, alignItems: 'center' }}>
              <Text style={{ color: colors.text.disabled, fontSize: 12 }}>Cancel provisioning</Text>
            </TouchableOpacity>
          )}
        </Card>
      </ScrollView>
    );
  }

  // ─── NO VPS STATE ───
  if (!hasIP) {
    return (
      <ScrollView contentContainerStyle={{ padding: spacing.base, paddingBottom: 80 }}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={styles.brandBox}>
              <Ionicons name="server" size={22} color={colors.brand.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Heading variant="h4">Dedicated VPS</Heading>
              <Text style={{ color: colors.text.secondary, fontSize: 12 }}>Your own static IP for broker whitelisting</Text>
            </View>
          </View>

          <View style={{ marginTop: spacing.lg }}>
            <Text style={{ color: colors.text.primary, fontSize: 36, fontWeight: '800' }}>
              ₹599<Text style={{ fontSize: 14, color: colors.text.secondary, fontWeight: '400' }}> / month</Text>
            </Text>
          </View>

          <View style={{ marginTop: spacing.base, gap: spacing.sm }}>
            {[
              'Own DigitalOcean droplet with dedicated IP',
              'No sharing — your IP is exclusively yours',
              'Auto-powered on trading days (08:55–15:31 IST)',
              'Order execution server pre-installed',
              'Renewal preserves your IP',
            ].map((f, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="checkmark-circle" size={16} color={colors.trading.profit} />
                <Text style={{ color: colors.text.secondary, fontSize: 13, flex: 1 }}>{f}</Text>
              </View>
            ))}
          </View>

          <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
            <Button
              title="Buy Dedicated IP — ₹599/month"
              onPress={() => setShowPayment(true)}
              loading={busy}
              testID="buy-dedicated-ip-button"
            />
            <Button
              title="I already have a VPS — recover it"
              variant="ghost"
              onPress={recoverVPS}
              loading={busy}
            />
          </View>
        </Card>

        {/* Payment sheet */}
        {showPayment && (
          <Card style={{ marginTop: spacing.base }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Heading variant="h4">Choose payment</Heading>
              <TouchableOpacity onPress={() => setShowPayment(false)}>
                <Ionicons name="close" size={20} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: spacing.base, gap: spacing.sm }}>
              <TouchableOpacity
                onPress={buyWithWallet}
                disabled={walletBalance < VPS_PRICE || busy}
                style={[styles.payOption, walletBalance < VPS_PRICE && { opacity: 0.5 }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="wallet" size={20} color={colors.brand.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 14 }}>Pay with Wallet</Text>
                    <Text style={{ color: colors.text.secondary, fontSize: 12 }}>
                      {walletBalance < VPS_PRICE
                        ? `Insufficient balance (₹${walletBalance} / ₹${VPS_PRICE})`
                        : `Balance: ₹${walletBalance.toLocaleString('en-IN')}`}
                    </Text>
                  </View>
                  {busy ? <ActivityIndicator size="small" color={colors.brand.primary} /> : <Ionicons name="chevron-forward" size={18} color={colors.text.secondary} />}
                </View>
              </TouchableOpacity>

              {walletBalance < VPS_PRICE && (
                <TouchableOpacity onPress={() => { setShowPayment(false); setShowAddFunds(true); }} style={styles.rechargeLink}>
                  <Text style={{ color: colors.brand.primary, fontSize: 13, fontWeight: '700' }}>+ Add funds to wallet</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={buyWithRazorpay}
                disabled={busy}
                style={styles.payOption}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="card" size={20} color="#7C5CFF" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 14 }}>Pay with Razorpay</Text>
                    <Text style={{ color: colors.text.secondary, fontSize: 12 }}>UPI · Cards · NetBanking</Text>
                  </View>
                  {busy ? <ActivityIndicator size="small" color="#7C5CFF" /> : <Ionicons name="chevron-forward" size={18} color={colors.text.secondary} />}
                </View>
              </TouchableOpacity>
            </View>
          </Card>
        )}
      </ScrollView>
    );
  }

  // ─── READY / ACTIVE STATE ───
  const daysLeft = daysUntil(assignment?.expiresAt);
  const subStatus = daysLeft > 7 ? 'active' : daysLeft > 0 ? 'expiring' : 'expired';
  const canConnect = daysLeft > 0;
  const ipAddr = assignment?.ipAddress || '';

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.base, paddingBottom: 80 }}>
      {/* IP Card */}
      <Card style={{ borderColor: canConnect ? 'rgba(0,255,102,0.3)' : colors.border.loss }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={[styles.brandBox, { backgroundColor: canConnect ? 'rgba(0,255,102,0.1)' : 'rgba(255,51,68,0.1)' }]}>
            <Ionicons name="server" size={22} color={canConnect ? colors.trading.profit : colors.trading.loss} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 }}>YOUR DEDICATED IP</Text>
            <Text style={{ ...(typography.metric as any), fontSize: 22, color: colors.text.primary, marginTop: 4 }}>
              {ipAddr || '…'}
            </Text>
          </View>
          {ipAddr ? (
            <TouchableOpacity onPress={copyIP} style={styles.copyBtn}>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={copied ? colors.trading.profit : colors.text.primary} />
              <Text style={{ color: copied ? colors.trading.profit : colors.text.primary, fontSize: 12, fontWeight: '700' }}>
                {copied ? 'Copied' : 'Copy'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.base }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: canConnect ? colors.trading.profit : colors.trading.loss }} />
          <Text style={{ color: canConnect ? colors.trading.profit : colors.trading.loss, fontSize: 13, fontWeight: '700' }}>
            {subStatus === 'active' ? 'ACTIVE' : subStatus === 'expiring' ? `EXPIRES IN ${daysLeft}d` : 'EXPIRED'}
          </Text>
          {assignment?.expiresAt ? (
            <Text style={{ color: colors.text.secondary, fontSize: 12 }}>
              · {new Date(assignment.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          ) : null}
        </View>

        {!canConnect && (
          <View style={{ marginTop: spacing.sm, backgroundColor: 'rgba(255,51,68,0.1)', padding: spacing.sm, borderRadius: radius.sm }}>
            <Text style={{ color: colors.trading.loss, fontSize: 12 }}>
              Subscription expired. Broker connections are blocked until you renew.
            </Text>
          </View>
        )}

        {daysLeft <= 7 && daysLeft > 0 && (
          <Button
            title={`Renew Subscription (₹${VPS_PRICE})`}
            onPress={() => setShowPayment(true)}
            loading={busy}
            style={{ marginTop: spacing.base }}
          />
        )}

        {daysLeft <= 0 && (
          <Button
            title={`Renew Subscription (₹${VPS_PRICE})`}
            onPress={() => setShowPayment(true)}
            loading={busy}
            style={{ marginTop: spacing.base }}
          />
        )}
      </Card>

      {/* VPS Power Banner */}
      {vpsPower?.success && (
        <Card style={{ marginTop: spacing.base, borderColor: 'rgba(0,191,255,0.2)' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="power" size={16} color={vpsPower.state === 'on' ? colors.trading.profit : colors.text.secondary} />
            <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: '700' }}>
              VPS {vpsPower.state === 'on' ? 'ON' : 'OFF'}
            </Text>
            <Text style={{ color: colors.text.secondary, fontSize: 12, flex: 1 }}>
              Auto-powered 08:55–15:31 IST on trading days
            </Text>
          </View>
        </Card>
      )}

      {/* Test Connection */}
      <Card style={{ marginTop: spacing.base }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 14 }}>Test Connection</Text>
            <Text style={{ color: colors.text.secondary, fontSize: 12, marginTop: 2 }}>
              Verify your order server is reachable
            </Text>
          </View>
          <TouchableOpacity onPress={testConnection} disabled={testingConn} style={styles.testBtn}>
            {testingConn ? <ActivityIndicator size="small" color={colors.brand.primary} /> : <Text style={{ color: colors.brand.primary, fontWeight: '700', fontSize: 13 }}>Test</Text>}
          </TouchableOpacity>
        </View>
      </Card>

      {/* Dhan Whitelist Steps */}
      <Card style={{ marginTop: spacing.base }}>
        <Text style={styles.label}>DHAN WHITELIST STEPS</Text>
        {[
          'Copy your IP address above',
          'Login to Dhan (web.dhan.co)',
          'Go to Settings → API Management',
          'Click "IP Whitelisting"',
          'Paste your IP and save',
        ].map((step, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: spacing.sm }}>
            <View style={styles.stepNum}>
              <Text style={{ color: '#050505', fontSize: 11, fontWeight: '800' }}>{i + 1}</Text>
            </View>
            <Text style={{ color: colors.text.secondary, fontSize: 13, flex: 1, lineHeight: 18 }}>{step}</Text>
          </View>
        ))}
      </Card>

      {/* Danger Zone */}
      <Card style={{ marginTop: spacing.base, borderColor: 'rgba(255,51,68,0.2)' }}>
        <Text style={[styles.label, { color: colors.trading.loss }]}>DANGER ZONE</Text>
        <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
          <Button title="Recreate IP" variant="ghost" onPress={recreateIP} loading={busy} />
          <Button title="Cancel subscription" variant="sell" onPress={cancelSubscription} loading={busy} />
        </View>
      </Card>

      {/* Payment sheet for renewal */}
      {showPayment && (
        <Card style={{ marginTop: spacing.base }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Heading variant="h4">Renew subscription</Heading>
            <TouchableOpacity onPress={() => setShowPayment(false)}>
              <Ionicons name="close" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <View style={{ marginTop: spacing.base, gap: spacing.sm }}>
            <TouchableOpacity
              onPress={buyWithWallet}
              disabled={walletBalance < VPS_PRICE || busy}
              style={[styles.payOption, walletBalance < VPS_PRICE && { opacity: 0.5 }]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="wallet" size={20} color={colors.brand.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 14 }}>Pay with Wallet</Text>
                  <Text style={{ color: colors.text.secondary, fontSize: 12 }}>
                    {walletBalance < VPS_PRICE
                      ? `Insufficient balance (₹${walletBalance} / ₹${VPS_PRICE})`
                      : `Balance: ₹${walletBalance.toLocaleString('en-IN')}`}
                  </Text>
                </View>
                {busy ? <ActivityIndicator size="small" color={colors.brand.primary} /> : <Ionicons name="chevron-forward" size={18} color={colors.text.secondary} />}
              </View>
            </TouchableOpacity>

            {walletBalance < VPS_PRICE && (
              <TouchableOpacity onPress={() => { setShowPayment(false); setShowAddFunds(true); }} style={styles.rechargeLink}>
                <Text style={{ color: colors.brand.primary, fontSize: 13, fontWeight: '700' }}>+ Add funds to wallet</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={buyWithRazorpay} disabled={busy} style={styles.payOption}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="card" size={20} color="#7C5CFF" />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 14 }}>Pay with Razorpay</Text>
                  <Text style={{ color: colors.text.secondary, fontSize: 12 }}>UPI · Cards · NetBanking</Text>
                </View>
                {busy ? <ActivityIndicator size="small" color="#7C5CFF" /> : <Ionicons name="chevron-forward" size={18} color={colors.text.secondary} />}
              </View>
            </TouchableOpacity>
          </View>
        </Card>
      )}

      {/* Razorpay Modal */}
      <RazorpayModal
        visible={!!razorpayOrder}
        order={razorpayOrder}
        onSuccess={handleRazorpaySuccess}
        onFailure={handleRazorpayFailure}
        onClose={() => setRazorpayOrder(null)}
      />

      {/* Add Funds Modal */}
      <AddFundsModal
        visible={showAddFunds}
        onClose={() => setShowAddFunds(false)}
        onSuccess={() => {
          setShowAddFunds(false);
          refreshAll();
        }}
        user={user || undefined}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  brandBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,191,255,0.1)',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  progressRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,191,255,0.1)',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bg.tertiary,
    overflow: 'hidden',
    marginTop: spacing.base,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.base,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  stepChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: colors.bg.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  stepChipActive: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  payOption: {
    padding: spacing.base,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.tertiary,
  },
  rechargeLink: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  testBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.brand.primary,
    backgroundColor: 'rgba(0,191,255,0.08)',
  },
  label: {
    color: colors.text.secondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});