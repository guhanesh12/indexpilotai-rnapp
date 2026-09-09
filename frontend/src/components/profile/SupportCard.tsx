import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SupportIcon } from '../icons/AppIcons';
import { useTheme } from '../../contexts/ThemeContext';

export default function SupportCard() {
  const router = useRouter();
  const { theme: colors } = useTheme();
  const iconColor = '#00B4FF';
  const styles = getStyles(colors);

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Support</Text>
      <TouchableOpacity
        style={styles.row}
        onPress={() => router.push('/(tabs)/support')}
      >
        <View style={[styles.iconWrap, { backgroundColor: `${iconColor}15`, borderColor: `${iconColor}55` }]}>
          <SupportIcon size={22} color={iconColor} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>Get Help</Text>
          <Text style={styles.subtitle}>Contact support, FAQ & feedback</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.border.default} />
      </TouchableOpacity>
    </View>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.bg.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border.default,
    },
    sectionTitle: {
      color: colors.text.secondary,
      fontSize: 13,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1.5,
      marginBottom: 12,
      opacity: 0.6,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
    },
    iconWrap: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      borderWidth: 1,
    },
    textWrap: {
      flex: 1,
    },
    title: {
      color: colors.text.primary,
      fontSize: 15,
      fontWeight: '700',
    },
    subtitle: {
      color: colors.text.secondary,
      fontSize: 12,
      marginTop: 2,
    },
  });
