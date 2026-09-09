
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { Heading, Body, Button } from '@/src/components/Primitives';
import { colors, spacing } from '@/src/lib/theme';
import { useAuth } from '@/src/contexts/AuthContext';
import { OtpInput } from 'react-native-otp-entry/dist/OtpInput';
import PinKeypad from '@/src/components/PinKeypad';

const { width } = Dimensions.get('window');

const RESEND_TIMEOUT = 30; // seconds

export default function OtpPinResetScreen() {
  const router = useRouter();
  const { resetPin, forgotPin, pinStatus } = useAuth();
  
  const [stage, setStage] = useState<'otp' | 'create' | 'confirm'>('otp');
  const [otp, setOtp] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_TIMEOUT);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(t => t - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleResend = async () => {
    if (resendTimer > 0) return;
    const response = await forgotPin();
    if (response.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResendTimer(RESEND_TIMEOUT);
    } else {
      Alert.alert('Error', response.message || 'Could not resend OTP.');
    }
  };

  const onOtpComplete = (code: string) => {
    setOtp(code);
    setStage('create');
  };

  const onPinComplete = async (pin: string) => {
    if (stage === 'create') {
      setNewPin(pin);
      setStage('confirm');
    } else if (stage === 'confirm') {
      if (pin !== newPin) {
        Alert.alert("PINs don't match", "Please re-enter your new PIN.");
        setNewPin('');
        setConfirmPin('');
        setStage('create');
        return;
      }
      setConfirmPin(pin);
      setIsLoading(true);
      const response = await resetPin(otp, newPin, pin);
      setIsLoading(false);
      if (response.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Success', 'Your PIN has been reset.', [
          {
            text: 'OK',
            onPress: () => {
              router.replace('/(tabs)/home' as any);
            }
          }
        ]);
      } else {
        Alert.alert('Error', response.message || 'Could not reset PIN.');
        setOtp('');
        setNewPin('');
        setConfirmPin('');
        setStage('otp');
      }
    }
  };

  const renderContent = () => {
    switch(stage) {
      case 'otp':
        return (
          <>
            <Heading variant="h3" style={styles.title}>Enter OTP</Heading>
            <Body style={styles.subtitle}>
              An OTP was sent to {pinStatus?.mobile || 'your mobile'}.
            </Body>
            <OtpInput
              numberOfDigits={6}
              onTextChange={(text: string) => setOtp(text)}
              onFilled={onOtpComplete}
              theme={{
                containerStyle: styles.otpContainer,
                pinCodeContainerStyle: styles.otpPinContainer,
                pinCodeTextStyle: styles.otpPinText,
                focusStickStyle: styles.otpFocus,
                focusedPinCodeContainerStyle: styles.otpFocusedContainer,
              }}
            />
            <TouchableOpacity onPress={handleResend} disabled={resendTimer > 0}>
              <Text style={[styles.resendText, resendTimer > 0 && styles.disabledText]}>
                {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
              </Text>
            </TouchableOpacity>
          </>
        );
      case 'create':
      case 'confirm':
        return (
          <>
            <Heading variant="h3" style={styles.title}>
              {stage === 'create' ? 'Create New PIN' : 'Confirm New PIN'}
            </Heading>
            <PinKeypad 
              value={stage === 'create' ? newPin : confirmPin}
              onChange={stage === 'create' ? setNewPin : setConfirmPin}
              onComplete={onPinComplete}
              length={4}
              disabled={isLoading}
            />
          </>
        )
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LinearGradient colors={[colors.bg.primary, '#1a1a2e', colors.bg.primary]} style={StyleSheet.absoluteFillObject} />
      <Animated.View entering={FadeInDown.springify()} layout={Layout.springify()} style={styles.content}>
        {renderContent()}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary, padding: spacing.lg, justifyContent: 'center' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { marginBottom: spacing.md, textAlign: 'center' },
  subtitle: { textAlign: 'center', color: colors.text.secondary, marginBottom: spacing.xl },
  otpContainer: { marginVertical: spacing.lg },
  otpPinContainer: { width: 60, height: 60, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderColor: colors.border.default },
  otpPinText: { color: colors.text.primary, fontSize: 24 },
  otpFocus: { backgroundColor: colors.brand.primary },
  otpFocusedContainer: { borderColor: colors.brand.primary },
  resendText: { color: colors.brand.primary, fontWeight: '600', marginTop: spacing.lg },
  disabledText: { opacity: 0.5 },
});
