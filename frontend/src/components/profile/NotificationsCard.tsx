import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Switch, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useProfile } from '../../hooks/useProfileData';
import { NotificationIcon } from '../icons/AppIcons';
import { useTheme } from '../../contexts/ThemeContext';

const cyan = '#00B4FF';

export default function NotificationsCard() {
  const { theme: colors } = useTheme();
  const { profile, loading } = useProfile();

  const [prefs, setPrefs] = useState<{
    email_enabled: boolean;
    sms_enabled?: boolean;
    whatsapp_enabled?: boolean;
    push_enabled?: boolean;
    trade_alerts?: boolean;
  } | null>(null);

  const userId = (profile as any)?.user_id;
  const [updating, setUpdating] = useState(false);

  const loadPrefs = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    setPrefs(
      (data as any) || {
        email_enabled: false,
        sms_enabled: false,
        whatsapp_enabled: false,
        push_enabled: true,
        trade_alerts: true,
      }
    );
  }, [userId]);

  React.useEffect(() => {
    loadPrefs().catch(() => {});
  }, [loadPrefs]);

  const emailEnabled = prefs?.email_enabled ?? false;

  const toggleEmail = useCallback(async (next: boolean) => {
    if (!userId) return;
    setUpdating(true);
    try {
      await supabase.from('notification_preferences').upsert({
        user_id: userId,
        email_enabled: next,
        sms_enabled: prefs?.sms_enabled ?? false,
        whatsapp_enabled: prefs?.whatsapp_enabled ?? false,
        push_enabled: prefs?.push_enabled ?? true,
        trade_alerts: prefs?.trade_alerts ?? true,
      });
      setPrefs((p) => (p ? { ...p, email_enabled: next } : p));
    } catch (e: any) {
      Alert.alert('Update failed', e?.message || 'Could not update notifications');
    } finally {
      setUpdating(false);
    }
  }, [prefs, userId]);

  const subtitle = useMemo(() => '⚡ ₹5 / day', []);

  const styles = getStyles(colors);

  if (loading || prefs === null) {
    return (
      <View style={[styles.card, styles.loadingContainer]}>
        <ActivityIndicator color={cyan} />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <View style={styles.iconWrap}>
          <NotificationIcon size={20} color={cyan} />
        </View>
        <View style={styles.subtitleChip}>
          <Text style={styles.subtitleChipText}>{subtitle}</Text>
        </View>
      </View>

      <Text style={styles.bodyText}>
        {`Email alerts for daily signals and trade P&L changes. Turn ON to get `}
        <Text style={styles.bodyBold}>₹5/day</Text>
        {` on trading days.`}
      </Text>

      <View style={[styles.rowBetween, { marginTop: 12 }]}>
        <Text style={styles.toggleLabel}>Email alerts</Text>
        <Switch
          value={emailEnabled}
          onValueChange={(v) => toggleEmail(v)}
          thumbColor={emailEnabled ? cyan : '#334155'}
          trackColor={{ false: '#1f2937', true: 'rgba(0,180,255,0.35)' }}
        />
      </View>

      {updating && (
        <View style={{ marginTop: 10 }}>
          <ActivityIndicator color={cyan} />
        </View>
      )}
    </View>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.bg.surface,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border.default,
    },
    loadingContainer: {
      minHeight: 120,
      justifyContent: 'center',
      alignItems: 'center',
    },
    rowBetween: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border.default,
      justifyContent: 'center',
      alignItems: 'center',
    },
    subtitleChip: {
      backgroundColor: 'rgba(0,180,255,0.12)',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: 'rgba(0,180,255,0.25)',
    },
    subtitleChipText: {
      color: cyan,
      fontWeight: '700',
      fontSize: 12,
    },
    bodyText: {
      marginTop: 14,
      color: colors.text.secondary,
      fontSize: 13,
      lineHeight: 18,
    },
    bodyBold: {
      color: colors.text.primary,
      fontWeight: '700',
    },
    toggleLabel: {
      color: colors.text.primary,
      fontSize: 14,
      fontWeight: '600',
    },
  });
