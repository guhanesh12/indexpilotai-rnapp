import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useAIChat } from '../contexts/AIChatContext';
import { colors } from '../lib/theme';

const TAB_BAR_HEIGHT = 70;
const TAB_BAR_MARGIN = 12;
const FAB_SIZE = 60;

export default function AIChatFab() {
  const { config, openSheet } = useAIChat();
  const insets = useSafeAreaInsets();

  // Hide when config says disabled
  if (config && !config.enabled) {
    return null;
  }

  // Pulse animation
  const pulse = useSharedValue(0.4);
  const scale = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 0.8 + pulse.value * 0.4 }],
  }));

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Glow animation for the inner icon
  const glow = useSharedValue(0.5);
  useEffect(() => {
    glow.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [glow]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + glow.value * 0.4,
  }));

  const handlePress = () => {
    scale.value = withTiming(0.9, { duration: 100 }, () => {
      scale.value = withTiming(1, { duration: 100 });
    });
    openSheet();
  };

  // Position: bottom-right, above the tab bar
  const bottomPosition = insets.bottom + TAB_BAR_HEIGHT + TAB_BAR_MARGIN + 16;

  return (
    <View style={[styles.container, { bottom: bottomPosition }]} pointerEvents="box-none">
      {/* Pulse ring */}
      <Animated.View style={[styles.pulse, pulseStyle]} />
      {/* Outer glow */}
      <Animated.View style={[styles.glow, glowStyle]} />
      {/* FAB */}
      <Animated.View style={scaleStyle}>
        <TouchableOpacity
          testID="ai-chat-fab"
          activeOpacity={0.85}
          onPress={handlePress}
          style={styles.fab}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="sparkles" size={24} color="#fff" />
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>AI</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  pulse: {
    position: 'absolute',
    width: FAB_SIZE + 8,
    height: FAB_SIZE + 8,
    borderRadius: (FAB_SIZE + 8) / 2,
    backgroundColor: '#7C5CFF',
    opacity: 0.35,
  },
  glow: {
    position: 'absolute',
    width: FAB_SIZE + 4,
    height: FAB_SIZE + 4,
    borderRadius: (FAB_SIZE + 4) / 2,
    backgroundColor: 'rgba(124,92,255,0.25)',
    shadowColor: '#7C5CFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 20,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: '#7C5CFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C5CFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FFD700',
    borderRadius: 10,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#050505',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  badgeText: {
    color: '#050505',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
