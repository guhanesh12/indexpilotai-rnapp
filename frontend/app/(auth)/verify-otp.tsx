import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Heading, Body } from '../../src/components/Primitives';
import { colors, spacing, radius } from '../../src/lib/theme';
import { api } from '../../src/lib/api';
import { useAuth } from '../../src/contexts/AuthContext';

export default function VerifyOtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    phone: string;
    email: string;
    password: string;
    name: string;
    state?: string;
    city?: string;
  }>();
  const { signIn } = useAuth();
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [err, setErr] = useState('');
  const refs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const onChangeDigit = (idx: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 1);
    const next = [...digits];
    next[idx] = d;
    setDigits(next);
    setErr('');
    if (d && idx < 5) refs.current[idx + 1]?.focus();
    if (next.every((x) => x) && next.join('').length === 6) {
      verify(next.join(''));
    }
  };

  const onKeyPress = (idx: number, key: string) => {
    if (key === 'Backspace' && !digits[idx] && idx > 0) {
      refs.current[idx - 1]?.focus();
    }
  };

  const verify = async (code: string) => {
    setErr('');
    setLoading(true);
    try {
      const res: any = await api.verifyOtp(
        params.phone as string,
        code
      );

      const session = res?.session || res;
      if (session?.access_token) {
        await signIn(
          res.user || { email: params.email, name: params.name },
          session.access_token,
          session.refresh_token || session.access_token
        );
        router.replace('/(auth)/pin-setup');
      } else {
        throw new Error(res?.error || 'Verification failed');
      }
    } catch (e: any) {
      setErr(e.message || 'OTP verification failed. Please try again.');
      setLoading(false);
    }
  };

  const resend = async () => {
    if (resendTimer > 0) return;
    setResending(true);
    setErr('');
    try {
      await api.sendOtp(
        params.phone as string,
        params.email as string,
        params.name as string
      );
      setResendTimer(60);
      setDigits(['', '', '', '', '', '']);
      refs.current[0]?.focus();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, padding: spacing.lg }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: spacing.lg }}>
          <Text style={{ color: colors.text.secondary }}>← Back</Text>
        </TouchableOpacity>

        <Heading variant="h1" style={{ marginBottom: spacing.sm }}>
          Verify OTP
        </Heading>
        <Body style={{ marginBottom: spacing.xl }}>
          We've sent a 6-digit code to +91 {params.phone}
        </Body>

        <View style={styles.otpRow}>
          {digits.map((d, i) => (
            <TextInput
              key={i}
              ref={(r) => {
                refs.current[i] = r;
              }}
              testID={`otp-digit-${i + 1}`}
              keyboardType="number-pad"
              maxLength={1}
              value={d}
              onChangeText={(v) => onChangeDigit(i, v)}
              onKeyPress={({ nativeEvent }) => onKeyPress(i, nativeEvent.key)}
              style={[styles.otpBox, d ? styles.otpBoxFilled : null]}
            />
          ))}
        </View>

        {err ? (
          <View style={styles.errBox}>
            <Text style={styles.errText}>{err}</Text>
          </View>
        ) : null}

        <Button
          testID="otp-verify-button"
          title="Verify & Create Account"
          onPress={() => verify(digits.join(''))}
          loading={loading}
          disabled={digits.join('').length < 6}
        />

        <TouchableOpacity
          onPress={resend}
          disabled={resending || resendTimer > 0}
          style={{ marginTop: spacing.lg, alignItems: 'center' }}
        >
          <Text style={{ color: resendTimer > 0 ? colors.text.disabled : colors.text.secondary }}>
            {resendTimer > 0 ? `Resend in ${resendTimer}s` : resending ? 'Sending...' : 'Resend OTP'}
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg },
  otpBox: {
    width: 48,
    height: 56,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    backgroundColor: colors.bg.secondary,
    color: colors.text.primary,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  otpBoxFilled: { borderColor: colors.trading.profit },
  errBox: {
    backgroundColor: 'rgba(255, 51, 68, 0.1)',
    borderWidth: 1,
    borderColor: colors.trading.loss,
    borderRadius: 4,
    padding: 12,
    marginBottom: spacing.base,
  },
  errText: { color: colors.trading.loss, fontSize: 13 },
});
