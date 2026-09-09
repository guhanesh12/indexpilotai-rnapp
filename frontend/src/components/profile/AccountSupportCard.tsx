import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { checkAppUpdate, openStore, type AppUpdateResponse } from '../../services/appUpdate';
import { getVersionDisplay } from '../../lib/version';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../contexts/ThemeContext';

const cyan = '#00B4FF';
const red = '#EF4444';

export default function AccountSupportCard() {
  const { theme: colors } = useTheme();
  const styles = getStyles(colors);
  const [updateCheck, setUpdateCheck] = useState(false);
  const [checkingResult, setCheckingResult] = useState<AppUpdateResponse | null>(null);

  const versionText = useMemo(() => getVersionDisplay(), []);

  const onCheckUpdates = useCallback(async () => {
    try {
      setUpdateCheck(true);
      setCheckingResult(null);
      const res = await checkAppUpdate(null as any);
      setCheckingResult(res);
      if (res.status === 'ok' && !res.storeUrl) {
        Alert.alert('Updates', 'You are already on the latest version.');
        return;
      }
      if (res.storeUrl) {
        Alert.alert(
          'Update available',
          res.message || 'A newer version is available. Do you want to update?',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Update', onPress: () => openStore(res.storeUrl ?? null) },
          ]
        );
      } else {
        Alert.alert('Updates', res.message || 'No update information available.');
      }
    } catch (e: any) {
      Alert.alert('Update check failed', e?.message || 'Could not check updates.');
    } finally {
      setUpdateCheck(false);
    }
  }, []);

  const onRequestDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete account',
      'Are you sure you want to request account deletion? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request delete',
          style: 'destructive',
          onPress: async () => {
            Alert.alert('Request sent', 'Your request is send our team we will reacjed soon');
            try { await supabase.auth.signOut(); } catch {}
          },
        },
      ]
    );
  }, []);

  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <View style={styles.iconWrap}>
          <Ionicons name="information-circle-outline" size={18} color={cyan} />
        </View>
        <Text style={styles.versionText}>{versionText}</Text>
      </View>
      <TouchableOpacity
        style={[styles.button, styles.updateButton]}
        onPress={onCheckUpdates}
        disabled={updateCheck}
      >
        {updateCheck ? (
          <ActivityIndicator color={colors.text.inverse} />
        ) : (
          <Ionicons name="refresh-outline" size={16} color={colors.text.inverse} />
        )}
        <Text style={styles.buttonText}>{updateCheck ? 'Checking...' : 'Check for updates'}</Text>
      </TouchableOpacity>
      <View style={styles.divider} />
      <TouchableOpacity style={[styles.button, styles.deleteButton]} onPress={onRequestDeleteAccount}>
        <Ionicons name="trash-outline" size={16} color={colors.text.inverse} />
        <Text style={[styles.buttonText, { color: colors.text.inverse }]}>Delete account</Text>
      </TouchableOpacity>
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
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border.default,
      alignItems: 'center',
      justifyContent: 'center',
    },
    versionText: {
      color: colors.text.primary,
      fontWeight: '800',
      fontSize: 14,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
    },
    updateButton: {
      borderColor: cyan,
      backgroundColor: cyan,
    },
    deleteButton: {
      borderColor: red,
      backgroundColor: red,
    },
    buttonText: {
      fontWeight: '800',
      fontSize: 14,
      color: colors.text.inverse,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border.default,
      marginVertical: 16,
    },
  });
