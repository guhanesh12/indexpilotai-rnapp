
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn, ZoomIn } from 'react-native-reanimated';
import { Heading, Body, Button } from '@/src/components/Primitives';
import { colors, spacing } from '@/src/lib/theme';
import { useAuth } from '@/src/contexts/AuthContext';
import { Feather } from '@expo/vector-icons';


const { width } = Dimensions.get('window');

export default function ForgotPinScreen() {
  const router = useRouter();
  const { forgotPin, pinStatus, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleSendOtp = async () => {
    setIsLoading(true);
    const response = await forgotPin();
    setIsLoading(false);
    
    if (response.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push('/otp-pin-reset' as any);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', response.message || 'Could not send OTP. Please try again.');
      if (response.message?.includes("No registered mobile")) {
        // Optional: deep-link to profile screen
        // router.push('/(tabs)/profile');
      }
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LinearGradient colors={[colors.bg.primary, '#1a1a2e', colors.bg.primary]} style={StyleSheet.absoluteFillObject} />
      <Animated.View style={styles.decorativeCircle} entering={FadeIn.duration(1000)} />

      <Animated.View style={styles.top} entering={FadeInDown.delay(100).springify()}>
        <Animated.View entering={ZoomIn.delay(200)} style={styles.iconContainer}>
          <Feather name="mail" size={28} color={colors.brand.primary} />
        </Animated.View>
        <Heading variant="h2" style={styles.title}>
          Forgot PIN
        </Heading>
        <Body style={styles.subtitle}>
          An OTP will be sent to your registered mobile number to reset your PIN.
        </Body>
      </Animated.View>

      <View style={styles.content}>
        {pinStatus?.mobile ? (
          <Body style={styles.mobileText}>
            OTP will be sent to: <Text style={{fontWeight: 'bold'}}>{pinStatus.mobile}</Text>
          </Body>
        ) : (
          <Body style={styles.mobileText}>
            An OTP will be sent to your registered mobile number.
          </Body>
        )}
      </View>
      
      <Animated.View style={styles.bottomContainer} entering={FadeInDown.delay(300)}>
        <Button 
          title="Send OTP" 
          onPress={handleSendOtp} 
          loading={isLoading}
        />
        <TouchableOpacity onPress={() => router.back()} style={styles.cancelBtn}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary, padding: spacing.lg, justifyContent: 'space-between' },
  decorativeCircle: { position: 'absolute', top: -width * 0.4, right: -width * 0.2, width: width, height: width, borderRadius: width / 2, backgroundColor: 'rgba(57, 255, 20, 0.05)' },
  top: { marginTop: spacing.xl, alignItems: 'center' },
  iconContainer: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(88, 86, 214, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg, borderWidth: 1, borderColor: 'rgba(88, 86, 214, 0.3)' },
  title: { marginBottom: spacing.sm, textAlign: 'center', fontSize: 32 },
  subtitle: { textAlign: 'center', color: colors.text.secondary, maxWidth: '80%' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mobileText: { fontSize: 16, color: colors.text.secondary },
  bottomContainer: { paddingBottom: spacing.lg, },
  cancelBtn: { marginTop: spacing.lg, padding: spacing.sm, alignSelf: 'center' },
  cancelBtnText: { color: colors.text.secondary, fontWeight: '600' }
});
