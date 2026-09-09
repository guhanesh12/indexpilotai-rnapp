import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn, Layout, ZoomIn } from 'react-native-reanimated';
import { Heading, Body } from '../../src/components/Primitives';
import { colors, spacing } from '../../src/lib/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import PinKeypad from '../../src/components/PinKeypad';

const { width } = Dimensions.get('window');

export default function PinSetupScreen() {
  const router = useRouter();
  const { setPin } = useAuth();
  const [stage, setStage] = useState<'create' | 'confirm'>('create');
  const [firstPin, setFirstPin] = useState('');
  const [currentPin, setCurrentPin] = useState('');

  const onPinComplete = async (pin: string) => {
    if (stage === 'create') {
      setFirstPin(pin);
      setCurrentPin('');
      setStage('confirm');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      if (pin === firstPin) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await setPin(pin, pin);
        router.replace('/(tabs)/home');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('PIN mismatch', 'Please re-enter to create your PIN');
        setStage('create');
        setFirstPin('');
        setCurrentPin('');
      }
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
        />
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
  }
});