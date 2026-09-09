import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { colors, spacing } from '../lib/theme';

type Props = {
  value: string;
  onChange: (v: string) => void;
  onComplete: (v: string) => void;
  length?: number;
  disabled?: boolean;
  showForgotPin?: boolean;
  onForgotPin?: () => void;
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'del'];

export default function PinKeypad({ value, onChange, onComplete, length = 4, disabled = false, showForgotPin = false, onForgotPin }: Props) {
  useEffect(() => {
    if (value.length === length) {
      const t = setTimeout(() => onComplete(value), 120);
      return () => clearTimeout(t);
    }
  }, [value, length]);

  const handlePress = (k: string) => {
    Haptics.selectionAsync();
    if (k === 'del') {
      onChange(value.slice(0, -1));
    } else if (k && value.length < length) {
      onChange(value + k);
    }
  };

  const handleForgotPin = () => {
    Haptics.selectionAsync();
    onForgotPin?.();
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.dots}>
        {Array.from({ length }).map((_, i) => (
          <PinDot key={i} filled={i < value.length} testID={`pin-input-${i + 1}`} />
        ))}
      </View>

      <View style={styles.grid}>
        {KEYS.map((k, idx) => {
          if (k === '0') {
            return (
              <TouchableOpacity
                key={idx}
                testID={`pin-keypad-${k}`}
                style={styles.key}
                onPress={() => handlePress(k)}
                activeOpacity={0.6}
                disabled={disabled}
              >
                <Text style={styles.keyText}>{k}</Text>
              </TouchableOpacity>
            );
          }
          if (k === 'del') {
            return (
              <TouchableOpacity
                key={idx}
                testID="pin-keypad-del"
                style={styles.key}
                onPress={() => handlePress(k)}
                activeOpacity={0.6}
                disabled={disabled}
              >
                <Text style={styles.keyText}>{'⌫'}</Text>
              </TouchableOpacity>
            );
          }
          return (
            <TouchableOpacity
              key={idx}
              testID={`pin-keypad-${k}`}
              style={styles.key}
              onPress={() => handlePress(k)}
              activeOpacity={0.6}
              disabled={disabled}
            >
              <Text style={styles.keyText}>{k}</Text>
            </TouchableOpacity>
          );
        })}
        {/* Forgot PIN button in bottom-left position, separate from 0 key */}
        {showForgotPin ? (
          <TouchableOpacity
            testID="pin-keypad-forgot"
            style={styles.forgotPinKey}
            onPress={handleForgotPin}
            activeOpacity={0.6}
            disabled={disabled}
          >
            <Text style={styles.forgotPinText}>Forgot?</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.key} />
        )}
      </View>
    </View>
  );
}

function PinDot({ filled, testID }: { filled: boolean; testID: string }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    scale.value = withSpring(filled ? 1.15 : 1, { damping: 12 });
    opacity.value = withTiming(filled ? 1 : 0.3, { duration: 200 });
  }, [filled]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
    backgroundColor: filled ? colors.text.primary : 'transparent',
  }));

  return (
    <Animated.View
      testID={testID}
      style={[
        { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.text.primary, marginHorizontal: 14 },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: spacing.lg, flex: 1, justifyContent: 'center' },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 60,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 300,
    justifyContent: 'center',
  },
  key: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 10,
  },
  keyText: {
    color: colors.text.primary,
    fontSize: 28,
    fontWeight: '300',
  },
  forgotPinKey: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 10,
  },
  forgotPinText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
});