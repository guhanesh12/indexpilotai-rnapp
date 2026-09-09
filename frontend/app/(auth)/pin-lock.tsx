import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn, ZoomIn } from 'react-native-reanimated';
import { Heading, Body } from '../../src/components/Primitives';
import { colors, spacing } from '../../src/lib/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import PinKeypad from '../../src/components/PinKeypad';
import { Feather } from '@expo/vector-icons';
import { isFingerprintAvailable } from '../../src/lib/fingerprint';

const { width } = Dimensions.get('window');

export default function PinLockScreen() {
  const router = useRouter();
  const { verifyPin, signOut, user, tryFingerprintUnlock } = useAuth();
  const [pin, setPin] = useState('');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [fingerprintAvailable, setFingerprintAvailable] = useState(false);

  useEffect(() => {
    isFingerprintAvailable().then(setFingerprintAvailable);
  }, []);

  // Auto-try fingerprint on mount
  useEffect(() => {
    if (fingerprintAvailable) {
      tryFingerprintUnlock().then(result => {
        if (result === 'success') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => {
            router.replace('/(tabs)/home' as any);
          }, 300);
        }
      });
    }
  }, [fingerprintAvailable]);

  const onComplete = async (p: string) => {
    const response = await verifyPin(p);
    if (response.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)/home');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setPin('');
      Alert.alert('Wrong PIN', 'Please try again');
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
      console.error('[PinLock] Sign out error:', error);
      setIsSigningOut(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LinearGradient
        colors={[colors.bg.primary, '#1a1a2e', colors.bg.primary]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <Animated.View 
        style={styles.decorativeCircle} 
        entering={FadeIn.duration(1000)}
      />

      {/* Top bar with mini fingerprint button on left */}
      <Animated.View style={styles.topBar} entering={FadeInDown.delay(100).springify()}>
        {fingerprintAvailable && (
          <TouchableOpacity
            testID="fingerprint-mini-button"
            onPress={handleFingerprintPress}
            style={styles.fingerprintMiniBtn}
            activeOpacity={0.7}
          >
            <Feather name="smartphone" size={20} color={colors.trading.profit} />
          </TouchableOpacity>
        )}
        {!fingerprintAvailable ? <View style={styles.fingerprintMiniBtnPlaceholder} /> : null}

        <View style={styles.centerContent}>
          <Animated.View entering={ZoomIn.delay(200)} style={styles.profileIconContainer}>
            <Feather name="lock" size={24} color={colors.trading.profit} />
          </Animated.View>
          <Heading variant="h2" style={{ marginBottom: spacing.sm, textAlign: 'center', fontSize: 32 }}>
            Enter PIN
          </Heading>
          <Body style={{ textAlign: 'center', color: colors.text.secondary }}>
            Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </Body>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300).springify()} style={{ flex: 1, justifyContent: 'center' }}>
        <PinKeypad 
          value={pin} 
          onChange={setPin} 
          onComplete={onComplete} 
          length={4}
          showForgotPin={true}
          onForgotPin={handleForgotPin}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(400).springify()}>
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
              Sign in with a different account
            </Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary, padding: spacing.lg },
  decorativeCircle: {
    position: 'absolute',
    top: -width * 0.4,
    right: -width * 0.2,
    width: width,
    height: width,
    borderRadius: width / 2,
    backgroundColor: 'rgba(57, 255, 20, 0.05)',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
  },
  profileIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(57, 255, 20, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(57, 255, 20, 0.3)',
    shadowColor: colors.trading.profit,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
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
  switchAccountBtn: { 
    flexDirection: 'row',
    alignItems: 'center', 
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    marginTop: spacing.xl,
  },
  signingOutContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    marginTop: spacing.xl,
  },
});