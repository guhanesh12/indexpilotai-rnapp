import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn, ZoomIn, Layout } from 'react-native-reanimated';
import { Heading, Body } from '@/src/components/Primitives';
import { colors, spacing } from '@/src/lib/theme';
import { useAuth } from '@/src/contexts/AuthContext';
import PinKeypad from '@/src/components/PinKeypad';
import { Feather } from '@expo/vector-icons';
import { isFingerprintAvailable } from '@/src/lib/fingerprint';

const { width } = Dimensions.get('window');

const Countdown = ({ until }: { until: string }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const lockedDate = new Date(until).getTime();
      const distance = lockedDate - now;

      if (distance < 0) {
        setTimeLeft('00:00');
        clearInterval(interval);
        return;
      }

      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);
      setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [until]);

  return <Text style={styles.errorText}>App Locked. Try again in: {timeLeft}</Text>;
};

export default function EnterPinScreen() {
  const router = useRouter();
  const { verifyPin, signOut, user, pinStatus, tryFingerprintUnlock, fingerprintEnabled } = useAuth();
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [fingerprintAvailable, setFingerprintAvailable] = useState(false);

  // Check if fingerprint hardware is available on mount
  useEffect(() => {
    isFingerprintAvailable().then(setFingerprintAvailable);
  }, []);

  // Auto-try fingerprint on mount after splash screen finished
  useEffect(() => {
    if (fingerprintAvailable && !isLocked) {
      tryFingerprintUnlock().then(result => {
        if (result === 'success') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => {
            router.replace('/(tabs)/home' as any);
          }, 300);
        }
        // If failed/cancelled, just stay on PIN screen
      });
    }
  }, [fingerprintAvailable]);

  const onComplete = async (p: string) => {
    setIsLoading(true);
    const response = await verifyPin(p);
    setIsLoading(false);

    if (response.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      console.log('[EnterPin] PIN verified successfully, navigating to home');
      setTimeout(() => {
        console.log('[EnterPin] Navigating to home screen');
        router.replace('/(tabs)/home' as any);
      }, 300);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.log('[EnterPin] PIN verification failed');
      setPin('');
    }
  };

  const handleForgotPin = () => {
    router.push('/forgot-pin' as any);
  };

  const handleFingerprintPress = async () => {
    Haptics.selectionAsync();
    const result = await tryFingerprintUnlock();
    if (result === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        router.replace('/(tabs)/home' as any);
      }, 300);
    } else if (result === 'cancelled') {
      // User cancelled fingerprint, just stay on PIN screen
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Fingerprint Failed', 'Please enter your PIN instead.');
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      // signOut clears session and state, _layout.tsx will handle navigation to login
    } catch (error) {
      console.error('[EnterPin] Sign out error:', error);
      setIsSigningOut(false);
    }
  };

  const isLocked = pinStatus?.lockedUntil && new Date(pinStatus.lockedUntil) > new Date();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LinearGradient colors={[colors.bg.primary, '#1a1a2e', colors.bg.primary]} style={StyleSheet.absoluteFillObject} />
      <Animated.View style={styles.decorativeCircle} entering={FadeIn.duration(1000)} />

      {/* Top bar with mini fingerprint button on left */}
      <Animated.View style={styles.topBar} entering={FadeInDown.delay(100).springify()} layout={Layout.springify()}>
        {/* Mini fingerprint button at top left */}
        {fingerprintAvailable && !isLocked && (
          <TouchableOpacity
            testID="fingerprint-mini-button"
            onPress={handleFingerprintPress}
            style={styles.fingerprintMiniBtn}
            activeOpacity={0.7}
          >
            <Feather name="smartphone" size={20} color={colors.trading.profit} />
          </TouchableOpacity>
        )}
        {!fingerprintAvailable || isLocked ? <View style={styles.fingerprintMiniBtnPlaceholder} /> : null}

        {/* Center content */}
        <View style={styles.topCenter}>
          <Animated.View entering={ZoomIn.delay(200)} style={styles.profileIconContainer}>
            <Feather name="lock" size={24} color={colors.trading.profit} />
          </Animated.View>
          <Text style={styles.welcomeText}>
            Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </Text>
          <Heading variant="h1" style={styles.title}>
            Enter PIN
          </Heading>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300).springify()} style={{ flex: 1, justifyContent: 'center' }}>
        <PinKeypad 
          value={pin} 
          onChange={setPin} 
          onComplete={onComplete} 
          length={4} 
          disabled={isLoading || !!isLocked}
          showForgotPin={true}
          onForgotPin={handleForgotPin}
        />
      </Animated.View>

      <Animated.View style={styles.bottomContainer} entering={FadeInDown.delay(400)}>
        {isLocked && pinStatus.lockedUntil ? (
          <Countdown until={pinStatus.lockedUntil} />
        ) : (
          pinStatus?.message && <Text style={styles.errorText}>{pinStatus.message}</Text>
        )}
        
        {/* Sign out button with loading indicator */}
        {isSigningOut ? (
          <View style={styles.signingOutContainer}>
            <ActivityIndicator size="small" color={colors.text.secondary} />
            <Text style={{ color: colors.text.secondary, fontSize: 14, fontWeight: '600', marginLeft: 8 }}>
              Signing out...
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={handleSignOut}
            style={styles.switchAccountBtn}
            disabled={isSigningOut}
          >
            <Feather name="log-out" size={16} color={colors.text.secondary} style={{ marginRight: 8 }} />
            <Text style={{ color: colors.text.secondary, fontSize: 14, fontWeight: '600' }}>
              Sign out
            </Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary, padding: spacing.lg },
  decorativeCircle: { position: 'absolute', top: -width * 0.4, right: -width * 0.2, width: width, height: width, borderRadius: width / 2, backgroundColor: 'rgba(57, 255, 20, 0.05)' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  topCenter: {
    flex: 1,
    alignItems: 'center',
  },
  profileIconContainer: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(57, 255, 20, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg, borderWidth: 1, borderColor: 'rgba(57, 255, 20, 0.3)', shadowColor: colors.trading.profit, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  title: { marginBottom: spacing.xl, textAlign: 'center', fontSize: 24, fontWeight: '700', marginTop: spacing.sm },
  welcomeText: { textAlign: 'center', color: colors.text.secondary, fontSize: 18, fontWeight: '600' },
  fingerprintMiniBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(57, 255, 20, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(57, 255, 20, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 10,
  },
  fingerprintMiniBtnPlaceholder: {
    width: 44,
    height: 44,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  bottomContainer: { minHeight: 100, justifyContent: 'center' },
  errorText: { color: colors.trading.loss, textAlign: 'center', marginBottom: spacing.md, fontSize: 14, fontWeight: '600' },
  switchAccountBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
  signingOutContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
});