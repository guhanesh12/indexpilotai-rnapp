/**
 * Welcome Bonus Popup Component
 * 
 * Shows a welcome gift popup when new users sign up.
 * Displays ₹100 signup bonus with expiry date.
 * Dark theme matching IndexPilot AI design.
 * 
 * Task Feature 2 - Welcome Popup + ₹100 Signup Bonus
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../lib/api';

// Get screen dimensions
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface WelcomeBonusPopupProps {
  /** Whether the popup is visible */
  visible: boolean;
  /** Callback when user taps the CTA button */
  onAccept: () => void;
  /** Callback when user closes the popup */
  onClose: () => void;
  /** Signup bonus amount (default: ₹100) */
  bonusAmount?: number;
  /** Bonus expiry date string */
  expiresAt?: string;
}

export default function WelcomeBonusPopup({
  visible,
  onAccept,
  onClose,
  bonusAmount = 100,
  expiresAt,
}: WelcomeBonusPopupProps) {
  const router = useRouter();
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));

  // Animation on mount/modal visible
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
    }
  }, [visible]);

// Format expiry date for display
  const formatExpiryDate = (dateStr?: string): string => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Handle expiry from props - support both bonusExpiresAt (for backward compat) and expiresAt
  const effectiveExpiresAt = expiresAt;

  const handleAccept = async () => {
    // Mark popup as seen in backend
    try {
      await api.updateProfileMe({ welcome_popup_seen: true });
      console.log('[WelcomeBonus] Popup marked as seen');
    } catch (error) {
      console.log('[WelcomeBonus] Error marking popup seen:', error);
    }

    // Call the accept callback
    onAccept();

    // Navigate to dashboard (use tabs group for expo-router)
    router.replace('/(tabs)/' as any);
  };

  // Don't render if not visible
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View
        style={[
          styles.overlay,
          { opacity: fadeAnim },
        ]}
      >
        {/* Backdrop press to close */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />

        {/* Popup Content */}
        <Animated.View
          style={[
            styles.container,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Gift Icon / Logo */}
          <View style={styles.iconContainer}>
            <Text style={styles.giftIcon}>🎁</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>Welcome Gift</Text>
          <Text style={styles.subtitle}>₹{bonusAmount} Signup Bonus</Text>

          {/* Description */}
          <Text style={styles.description}>
            Start your trading journey with ₹{bonusAmount} free bonus! Use it to power your AI trading engine.
          </Text>

{/* Expiry Info */}
          {effectiveExpiresAt && (
            <View style={styles.expiryContainer}>
              <Text style={styles.expiryLabel}>Expires on</Text>
              <Text style={styles.expiryDate}>
                {formatExpiryDate(effectiveExpiresAt)}
              </Text>
            </View>
          )}

          {/* CTA Button */}
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={handleAccept}
            activeOpacity={0.8}
          >
            <Text style={styles.ctaButtonText}>Start Trading →</Text>
          </TouchableOpacity>

          {/* Skip/Later Button */}
          <TouchableOpacity
            style={styles.skipButton}
            onPress={onClose}
            activeOpacity={0.6}
          >
            <Text style={styles.skipButtonText}>Maybe Later</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// Check if user should see welcome popup
export async function checkWelcomeBonus(): Promise<{
  shouldShow: boolean;
  bonusAmount: number;
  expiresAt?: string;
}> {
  try {
    // API request automatically includes auth token
    const response = await api.getProfileMe();
    const profile = response?.profile;

    if (
      profile &&
      profile.welcome_popup_seen === false &&
      profile.signup_bonus_amount > 0
    ) {
      return {
        shouldShow: true,
        bonusAmount: profile.signup_bonus_amount,
        expiresAt: profile.signup_bonus_expires_at,
      };
    }

    return { shouldShow: false, bonusAmount: 0 };
  } catch (error) {
    console.log('[WelcomeBonus] Error checking bonus:', error);
    return { shouldShow: false, bonusAmount: 0 };
  }
}

// Styles
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: SCREEN_WIDTH * 0.85,
    backgroundColor: '#0A0820',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(124, 92, 255, 0.3)',
    shadowColor: '#7C5CFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(124, 92, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  giftIcon: {
    fontSize: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#00FF66',
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  expiryContainer: {
    backgroundColor: 'rgba(255, 184, 0, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  expiryLabel: {
    fontSize: 12,
    color: '#FFB800',
    marginRight: 8,
  },
  expiryDate: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFB800',
  },
  ctaButton: {
    backgroundColor: '#7C5CFF',
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  ctaButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  skipButton: {
    paddingVertical: 8,
  },
  skipButtonText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
  },
});
