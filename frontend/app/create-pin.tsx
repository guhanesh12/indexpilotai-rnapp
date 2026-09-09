import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, Dimensions, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn, Layout, ZoomIn } from 'react-native-reanimated';
import { Heading, Body } from '@/src/components/Primitives';
import { colors, spacing } from '@/src/lib/theme';
import { useAuth } from '@/src/contexts/AuthContext';
import PinKeypad from '@/src/components/PinKeypad';
import { Feather } from '@expo/vector-icons';
import { isFingerprintAvailable } from '@/src/lib/fingerprint';

const { width } = Dimensions.get('window');

export default function CreatePinScreen() {
  const router = useRouter();
  const { setPin, setFingerprintEnabled } = useAuth();
  const [stage, setStage] = useState<'create' | 'confirm'>('create');
  const [firstPin, setFirstPin] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [showFingerprintPrompt, setShowFingerprintPrompt] = useState(false);
  const [fingerprintAvailable, setFingerprintAvailable] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  // Check fingerprint availability when PIN is successfully created
  useEffect(() => {
    if (showFingerprintPrompt) {
      isFingerprintAvailable().then(setFingerprintAvailable);
    }
  }, [showFingerprintPrompt]);

  const onPinComplete = async (pin: string) => {
    if (stage === 'create') {
      setFirstPin(pin);
      setCurrentPin('');
      setStage('confirm');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      if (pin !== firstPin) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('PINs do not match', 'Please start over.');
        setStage('create');
        setFirstPin('');
        setCurrentPin('');
        return;
      }
      
      setIsLoading(true);
      const response = await setPin(firstPin, pin);
      setIsLoading(false);

      if (response.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Show fingerprint setup prompt after PIN is created
        setShowFingerprintPrompt(true);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Error', response.message || 'Could not set PIN. Please try again.');
        setStage('create');
        setFirstPin('');
        setCurrentPin('');
      }
    }
  };

  const handleEnableFingerprint = async () => {
    await setFingerprintEnabled(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowFingerprintPrompt(false);
    // Navigate to home - pinState is already 'unlocked'
    router.replace('/(tabs)/home' as any);
  };

  const handleSkipFingerprint = () => {
    setShowFingerprintPrompt(false);
    // Navigate to home - pinState is already 'unlocked'
    router.replace('/(tabs)/home' as any);
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

      <Animated.View 
        style={styles.top} 
        entering={FadeInDown.delay(100).springify()} 
        layout={Layout.springify()}
      >
        <Animated.View entering={ZoomIn.delay(200)} style={styles.iconContainer}>
          <View style={styles.lockIconCore} />
        </Animated.View>
        <Heading variant="h2" style={{ marginBottom: spacing.sm, textAlign: 'center', fontSize: 32 }}>
          {stage === 'create' ? 'Create PIN' : 'Confirm PIN'}
        </Heading>
        <Body style={{ textAlign: 'center', color: colors.text.secondary }}>
          {stage === 'create' ? 'Secure your app with a 4-digit PIN' : 'Re-enter to confirm your new PIN'}
        </Body>
      </Animated.View>
      
      <Animated.View entering={FadeInDown.delay(300).springify()} style={{ flex: 1, justifyContent: 'center' }}>
        <PinKeypad
          value={currentPin}
          onChange={setCurrentPin}
          onComplete={onPinComplete}
          length={4}
          disabled={isLoading}
        />
      </Animated.View>

      {/* Fingerprint setup prompt - shows after PIN is created */}
      {showFingerprintPrompt && (
        <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.fingerprintSetupContainer}>
          <LinearGradient
            colors={['rgba(57, 255, 20, 0.15)', 'rgba(57, 255, 20, 0.05)']}
            style={styles.fingerprintSetupCard}
          >
            <Feather name="smartphone" size={32} color={colors.trading.profit} style={{ marginBottom: spacing.sm }} />
            <Heading variant="h3" style={{ color: '#fff', marginBottom: spacing.sm, textAlign: 'center' }}>
              Enable Fingerprint Unlock?
            </Heading>
            <Body style={{ color: colors.text.secondary, textAlign: 'center', marginBottom: spacing.lg }}>
              {fingerprintAvailable
                ? 'Use your fingerprint to quickly unlock IndexPilot AI instead of entering your PIN every time.'
                : 'Fingerprint hardware is not available on this device. You can still use your PIN to unlock.'}
            </Body>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <TouchableOpacity
                onPress={handleEnableFingerprint}
                disabled={!fingerprintAvailable}
                style={[styles.fingerprintSetupBtn, { backgroundColor: colors.trading.profit, opacity: fingerprintAvailable ? 1 : 0.5 }]}
              >
                <Text style={{ color: '#000', fontWeight: '800', fontSize: 14 }}>Enable</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSkipFingerprint}
                style={styles.fingerprintSetupBtn}
              >
                <Text style={{ color: colors.text.secondary, fontWeight: '700', fontSize: 14 }}>Skip</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      )}
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
  top: { marginTop: spacing.xl, marginBottom: spacing.xl, alignItems: 'center' },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(57, 255, 20, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(57, 255, 20, 0.3)',
  },
  lockIconCore: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.trading.profit,
    shadowColor: colors.trading.profit,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  fingerprintSetupContainer: {
    marginTop: spacing.xl,
  },
  fingerprintSetupCard: {
    borderRadius: 20,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(57, 255, 20, 0.3)',
  },
  fingerprintSetupBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
});
