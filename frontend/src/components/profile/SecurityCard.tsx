import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

const cyan = '#00B4FF';
const red = '#EF4444';

export default function SecurityCard() {
  const { theme: colors } = useTheme();
  const { user } = useAuth();
  const styles = getStyles(colors);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  const canReset = useMemo(() => !!user?.email, [user?.email]);

  const onChangePassword = useCallback(async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Missing fields', 'Enter new password and confirm it.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      Alert.alert('Password updated', 'Your password has been changed.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      Alert.alert('Update failed', e?.message || 'Could not update password.');
    } finally {
      setSavingPassword(false);
    }
  }, [confirmPassword, newPassword]);

  const onSendResetEmail = useCallback(async () => {
    if (!user?.email) {
      Alert.alert('Email missing', 'Could not find your email for reset.');
      return;
    }
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email);
      if (error) throw error;
      Alert.alert('Reset email sent', 'Check your email for password reset instructions.');
    } catch (e: any) {
      Alert.alert('Reset failed', e?.message || 'Could not send reset email.');
    } finally {
      setSendingReset(false);
    }
  }, [user?.email]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Ionicons name="shield-checkmark-outline" size={20} color={cyan} />
        </View>
        <Text style={styles.title}>Security</Text>
      </View>

      <Text style={styles.sectionLabel}>Change password</Text>
      <TextInput
        value={newPassword}
        onChangeText={setNewPassword}
        placeholder="New password"
        placeholderTextColor={colors.text.secondary}
        secureTextEntry
        style={styles.input}
        autoCapitalize="none"
      />
      <TextInput
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Confirm password"
        placeholderTextColor={colors.text.secondary}
        secureTextEntry
        style={styles.input}
        autoCapitalize="none"
      />

      <TouchableOpacity
        style={[styles.ctaButton, savingPassword && { opacity: 0.7 }]}
        onPress={onChangePassword}
        disabled={savingPassword}
      >
        {savingPassword ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Ionicons name="key-outline" size={16} color="#000" />
        )}
        <Text style={styles.ctaButtonText}>
          {savingPassword ? 'Updating...' : 'Update password'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.secondaryButton, sendingReset && { opacity: 0.7 }]}
        onPress={onSendResetEmail}
        disabled={!canReset || sendingReset}
      >
        {sendingReset ? (
          <ActivityIndicator color={cyan} />
        ) : (
          <Ionicons name="mail-outline" size={16} color={cyan} />
        )}
        <Text style={styles.secondaryButtonText}>
          {sendingReset ? 'Sending...' : 'Send reset email'}
        </Text>
      </TouchableOpacity>

      <View style={styles.divider} />

      <View style={styles.rowBetween}>
        <Text style={styles.sectionLabel}>Biometric</Text>
        <TouchableOpacity
          onPress={() => setBiometricEnabled((v) => !v)}
          style={[
            styles.biometricToggle,
            biometricEnabled
              ? { borderColor: cyan, backgroundColor: 'rgba(34,211,238,0.12)' }
              : null,
          ]}
        >
          <Text
            style={[
              styles.biometricToggleText,
              biometricEnabled ? { color: cyan } : null,
            ]}
          >
            {biometricEnabled ? 'Enabled' : 'Disabled'}
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.hintText}>Enable biometric for faster login on this device.</Text>
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
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
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
    title: {
      color: colors.text.primary,
      fontWeight: '800',
      fontSize: 18,
      flex: 1,
      marginLeft: 12,
    },
    sectionLabel: {
      color: colors.text.primary,
      fontWeight: '700',
      fontSize: 14,
      marginBottom: 10,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border.default,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      color: colors.text.primary,
      marginBottom: 10,
    },
    ctaButton: {
      backgroundColor: cyan,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 10,
      marginTop: 8,
    },
    ctaButtonText: {
      color: '#000',
      fontWeight: '800',
      fontSize: 14,
    },
    secondaryButton: {
      marginTop: 12,
      borderWidth: 1,
      borderColor: cyan,
      backgroundColor: 'transparent',
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 10,
    },
    secondaryButtonText: {
      color: cyan,
      fontWeight: '800',
      fontSize: 14,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border.default,
      marginVertical: 18,
    },
    rowBetween: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    biometricToggle: {
      borderWidth: 1,
      borderColor: colors.border.default,
      backgroundColor: 'transparent',
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 999,
    },
    biometricToggleText: {
      fontWeight: '700',
      fontSize: 13,
      color: colors.text.secondary,
    },
    hintText: {
      marginTop: 12,
      color: colors.text.secondary,
      fontSize: 12,
      lineHeight: 18,
    },
  });
