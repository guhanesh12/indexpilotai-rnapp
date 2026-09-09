import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../contexts/ThemeContext';
import { LoginIcon } from '../icons/AppIcons';

const spacing = { base: 16, sm: 8, lg: 24, xs: 4 };
const radius = { xl: 16 };

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

interface ReferralCardProps {
  code: { code: string } | null;
  earnings: { total_earned: number; successful_count: number } | null;
  referredUsers: any[] | null;
  loading: boolean;
}

export default function ReferralCard({ code, earnings, referredUsers, loading }: ReferralCardProps) {
  const { theme: colors } = useTheme();
  const styles = getStyles(colors);
  const [showDetails, setShowDetails] = useState(false);
  const referralCode = code?.code;
  const shareUrl = `https://indexpilotai.com/register?ref=${referralCode}`;

    const onShare = async () => {
        if (!referralCode) return;
        try {
          await Share.share({
            message: `Join me on IndexPilot AI! Use my referral code: ${referralCode}
${shareUrl}`,
            url: shareUrl
          });
        } catch (error: any) {
          console.error('Error sharing', error.message);
        }
      };

    const onCopy = (text: string) => {
        if (!text) return;
        Clipboard.setStringAsync(text);
        alert('Copied to clipboard!');
    }

  if (loading) {
    return (
      <View style={[styles.card, styles.loadingContainer]}>
        <ActivityIndicator color={colors.brand.primary} />
      </View>
    );
  }

  if (!referralCode) {
    return (
        <View style={styles.card}>
            <Text style={styles.title}>Referral Program</Text>
            <View style={styles.noCodeContainer}>
                <Ionicons name="gift-outline" size={48} color={colors.brand.primary} />
                <Text style={styles.noCodeTitle}>Refer & Earn Rewards</Text>
                <Text style={styles.noCodeText}>You don't have a referral code yet. Start referring friends once you're eligible!</Text>
                <TouchableOpacity style={[styles.shareButton, {opacity: 0.6}]}>
                    <Text style={styles.shareButtonText}>Learn More</Text>
                </TouchableOpacity>
            </View>
        </View>
    )
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Referral Program</Text>
      <View style={styles.codeContainer}>
        <Text style={styles.code}>{referralCode}</Text>
        <TouchableOpacity onPress={() => onCopy(referralCode)}>
            <Ionicons name="copy-outline" size={24} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>
      <Text style={styles.earningsText}>
        Total earned{' '}
        <Text style={{ color: colors.text.primary }}>
          {formatCurrency(earnings?.total_earned || 0)}
        </Text>
        {' · '}
        <Text style={{ color: colors.text.primary }}>
          {earnings?.successful_count || 0} successful
        </Text>
      </Text>

      <TouchableOpacity style={styles.shareButton} onPress={onShare}>
        <Ionicons name="share-social-outline" size={20} color={'#000'} />
        <Text style={styles.shareButtonText}>Share your code</Text>
      </TouchableOpacity>

      {!!referredUsers?.length && (
        <TouchableOpacity 
          style={styles.viewDetailsBtn} 
          onPress={() => setShowDetails(!showDetails)}
        >
          <Text style={styles.viewDetailsBtnText}>
            {showDetails ? 'Hide Referral Details' : `View Referral Details (${referredUsers.length})`}
          </Text>
          <Ionicons 
            name={showDetails ? 'chevron-up' : 'chevron-down'} 
            size={16} 
            color={colors.brand.primary} 
          />
        </TouchableOpacity>
      )}

      {showDetails && !!referredUsers?.length && (
        <View style={{ marginTop: spacing.base }}>
          <Text style={styles.detailsTitle}>Referral Details</Text>
          {referredUsers.map((r: any, idx: number) => (
            <View key={r?.referee_user_id || idx} style={styles.detailRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailName}>
                  {r?.referee_name || r?.referee_email?.split('@')[0] || `User #${idx + 1}`}
                </Text>
                <Text style={styles.detailSub}>
                  Status: {r?.status || '—'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.detailReward}>
                  ₹{Math.round(r?.reward_amount || 0)}
                </Text>
                <Text style={styles.detailSub}>
                  {r?.created_at ? String(r.created_at).slice(0, 10) : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.bg.surface,
      borderRadius: radius.xl,
      padding: spacing.base,
      marginBottom: spacing.base,
      borderWidth: 1,
      borderColor: colors.border.default,
    },
    loadingContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      height: 150
    },
    title: {
      color: colors.text.primary,
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: spacing.base,
    },
    codeContainer: {
      backgroundColor: colors.bg.primary,
      borderRadius: radius.xl,
      padding: spacing.base,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    code: {
      color: colors.brand.primary,
      fontSize: 24,
      fontWeight: 'bold',
      fontFamily: 'monospace',
    },
    earningsText: {
      color: colors.text.secondary,
      fontSize: 14,
      textAlign: 'center',
      marginVertical: spacing.base,
    },
    shareButton: {
      backgroundColor: colors.brand.primary,
      borderRadius: radius.xl,
      padding: spacing.base,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: spacing.sm
    },
    shareButtonText: {
      color: '#000',
      fontSize: 16,
      fontWeight: 'bold',
    },
    noCodeContainer: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
    },
    noCodeTitle: {
      color: colors.text.primary,
      fontSize: 18,
      fontWeight: 'bold',
      marginTop: spacing.base,
      marginBottom: spacing.sm,
    },
    noCodeText: {
      color: colors.text.secondary,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },

    viewDetailsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: 'rgba(34, 211, 238, 0.08)',
      borderWidth: 1,
      borderColor: 'rgba(34, 211, 238, 0.3)',
      borderRadius: radius.xl,
      paddingVertical: 12,
      marginTop: spacing.sm,
    },
    viewDetailsBtnText: {
      color: colors.brand.primary,
      fontSize: 14,
      fontWeight: '700',
    },
    detailsTitle: {
      color: colors.text.primary,
      fontSize: 14,
      fontWeight: '700',
      marginBottom: spacing.sm,
    },
    detailRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.border.default,
    },
    detailName: {
      color: colors.text.primary,
      fontSize: 13,
      fontWeight: '600',
    },
    detailSub: {
      color: colors.text.secondary,
      fontSize: 12,
      marginTop: 2,
    },
    detailReward: {
      color: colors.brand.primary,
      fontSize: 13,
      fontWeight: '700',
    },
  });
