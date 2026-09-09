import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  TextInputProps,
} from 'react-native';
import { colors, spacing, radius, typography } from '../lib/theme';

export const Screen: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({ children, style }) => (
  <View style={[s.screen, style]}>{children}</View>
);

export const Card: React.FC<{ children: React.ReactNode; style?: ViewStyle; testID?: string }> = ({
  children,
  style,
  testID,
}) => (
  <View testID={testID} style={[s.card, style]}>
    {children}
  </View>
);

type HeadingProps = { children: React.ReactNode; variant?: keyof typeof typography; color?: string; style?: TextStyle; testID?: string; numberOfLines?: number };
export const Heading: React.FC<HeadingProps> = ({ children, variant = 'h2', color, style, testID, numberOfLines }) => (
  <Text testID={testID} numberOfLines={numberOfLines} style={[{ color: color || colors.text.primary }, typography[variant] as any, style]}>
    {children}
  </Text>
);

export const Body: React.FC<{ children: React.ReactNode; color?: string; style?: TextStyle; size?: 'body' | 'bodySmall' | 'caption' }> = ({
  children,
  color,
  style,
  size = 'body',
}) => (
  <Text style={[{ color: color || colors.text.secondary }, typography[size] as any, style]}>
    {children}
  </Text>
);

type BtnProps = {
  onPress: () => void;
  title: string;
  variant?: 'primary' | 'ghost' | 'buy' | 'sell';
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  style?: ViewStyle;
};
export const Button: React.FC<BtnProps> = ({ onPress, title, variant = 'primary', loading, disabled, testID, style }) => {
  const btnStyle =
    variant === 'primary'
      ? s.btnPrimary
      : variant === 'ghost'
      ? s.btnGhost
      : variant === 'buy'
      ? s.btnBuy
      : s.btnSell;
  const txtColor =
    variant === 'primary' ? '#050505' : variant === 'buy' ? colors.trading.profit : variant === 'sell' ? colors.trading.loss : colors.text.primary;
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[s.btn, btnStyle, (disabled || loading) && { opacity: 0.5 }, style]}
    >
      {loading ? (
        <ActivityIndicator color={txtColor} />
      ) : (
        <Text style={[s.btnText, { color: txtColor }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

export const Input: React.FC<TextInputProps & { label?: string; testID?: string }> = ({ label, style, testID, ...props }) => (
  <View style={{ marginBottom: spacing.base }}>
    {label ? <Text style={[typography.caption as any, { color: colors.text.secondary, marginBottom: spacing.sm }]}>{label}</Text> : null}
    <TextInput
      testID={testID}
      placeholderTextColor={colors.text.disabled}
      style={[s.input, style]}
      {...props}
    />
  </View>
);

export const Chip: React.FC<{ label: string; active?: boolean; onPress?: () => void; testID?: string }> = ({
  label,
  active,
  onPress,
  testID,
}) => (
  <TouchableOpacity
    testID={testID}
    onPress={onPress}
    activeOpacity={0.8}
    style={[s.chip, active && s.chipActive]}
  >
    <Text style={{ color: active ? '#050505' : colors.text.primary, fontSize: 13, fontWeight: '600' }}>{label}</Text>
  </TouchableOpacity>
);

export const Divider: React.FC<{ style?: ViewStyle }> = ({ style }) => <View style={[s.divider, style]} />;

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.primary },
  card: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.lg,
  },
  btn: {
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  btnPrimary: { backgroundColor: colors.brand.primary },
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  btnBuy: {
    backgroundColor: 'rgba(0, 255, 102, 0.1)',
    borderWidth: 1,
    borderColor: colors.trading.profit,
  },
  btnSell: {
    backgroundColor: 'rgba(255, 51, 68, 0.1)',
    borderWidth: 1,
    borderColor: colors.trading.loss,
  },
  btnText: { fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  input: {
    backgroundColor: colors.bg.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: 14,
    color: colors.text.primary,
    fontSize: 15,
  },
  chip: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginRight: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  divider: { height: 1, backgroundColor: colors.border.default, marginVertical: spacing.base },
});
