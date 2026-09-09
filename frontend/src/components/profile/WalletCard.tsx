import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWallet, useProfile } from '../../hooks/useProfileData';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';

const spacing = { base: 16, sm: 8, xs: 4 };
const radius = { xl: 16, lg: 12 };

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
};

const getDaysUntilExpiry = (dateStr: string | null) => {
    if (!dateStr) return null;
    const expiryDate = new Date(dateStr);
    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
};

export default function WalletCard({ wallet, profile, loading }: { wallet: any; profile: any; loading: boolean }) {
  const { theme: colors } = useTheme();
  const styles = getStyles(colors);

  const renderBonusChip = () => {
    if (!profile || !profile.signup_bonus_remaining || profile.signup_bonus_remaining <= 0) {
      return null;
    }
    const daysLeft = getDaysUntilExpiry(profile.signup_bonus_expires_at);
    if (daysLeft === null || daysLeft < 0) return null;

    return (
      <View style={styles.bonusChip}>
        <Text style={styles.bonusChipText}>
          Bonus {formatCurrency(profile.signup_bonus_remaining)} left
          {daysLeft !== null && ` · expires in ${daysLeft}d`}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.card, styles.loadingContainer]}>
        <ActivityIndicator color={colors.brand.primary} />
      </View>
    );
  }

  return (
    <LinearGradient
        colors={[colors.bg.surface, colors.bg.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
    >
      <View style={styles.balanceContainer}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceAmount}>{formatCurrency(wallet?.balance || 0)}</Text>
        {renderBonusChip()}
      </View>
    </LinearGradient>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    card: {
      borderRadius: radius.xl,
      padding: spacing.base,
      marginBottom: spacing.base,
      borderWidth: 1,
      borderColor: colors.border.default,
    },
    loadingContainer: {
      justifyContent: 'center',
      alignItems: 'center'
    },
    balanceContainer: {
      alignItems: 'center',
      marginBottom: spacing.base,
    },
    balanceLabel: {
      color: colors.text.secondary,
      fontSize: 14,
    },
    balanceAmount: {
      color: colors.text.primary,
      fontSize: 36,
      fontWeight: 'bold',
      marginVertical: spacing.sm,
    },
    bonusChip: {
      backgroundColor: `rgba(244, 180, 0, 0.1)`,
      borderColor: colors.status.gold,
      borderWidth: 1,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    bonusChipText: {
      color: colors.status.gold,
      fontSize: 12,
      fontWeight: '600',
    },
  });
