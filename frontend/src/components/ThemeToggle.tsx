import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTheme } from '@/src/contexts/ThemeContext';

interface ThemeToggleProps {
  showLabel?: boolean;
  style?: any;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ showLabel = true, style }) => {
  const { theme, themeMode, setThemeMode, isDark, isLight } = useTheme();
  const [loading, setLoading] = useState(false);

  const handleToggle = async (mode: 'dark' | 'light') => {
    if (loading || mode === themeMode) return;
    setLoading(true);
    try {
      await setThemeMode(mode);
    } finally {
      setLoading(false);
    }
  };

  const isToggled = (Platform.OS === 'web' ? isDark : isDark);

  return (
    <View style={[styles.container, style]}>
      {showLabel && (
        <Text style={[styles.label, { color: theme.text.secondary }]}>
          Theme
        </Text>
      )}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[
            styles.option,
            { backgroundColor: theme.bg.secondary, borderColor: theme.border.default },
            isDark && styles.optionActive,
            isDark && { backgroundColor: theme.brand.primary, borderColor: theme.brand.primary },
            loading && styles.optionDisabled,
          ]}
          onPress={() => handleToggle('dark')}
          disabled={loading}
          activeOpacity={0.7}
        >
          <View style={styles.optionContent}>
            <View style={[styles.dot, isDark && styles.dotActive, { backgroundColor: '#000' }]} />
            <Text style={[styles.optionText, { color: isDark ? '#000' : theme.text.secondary }, isDark && styles.optionTextActive]}>
              Dark
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.option,
            { backgroundColor: theme.bg.secondary, borderColor: theme.border.default },
            isLight && styles.optionActive,
            isLight && { backgroundColor: '#FFD600', borderColor: '#FFD600' },
            loading && styles.optionDisabled,
          ]}
          onPress={() => handleToggle('light')}
          disabled={loading}
          activeOpacity={0.7}
        >
          <View style={styles.optionContent}>
            <View style={[styles.dot, isLight && styles.dotActive, { backgroundColor: '#FFF930' }]} />
            <Text style={[styles.optionText, { color: isLight ? '#000' : theme.text.secondary }, isLight && styles.optionTextActive]}>
              Light
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  toggleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    opacity: 1,
  },
  optionActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  optionDisabled: {
    opacity: 0.5,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.5,
  },
  dotActive: {
    opacity: 1,
  },
  optionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  optionTextActive: {
    fontWeight: '700',
  },
});

export default ThemeToggle;
