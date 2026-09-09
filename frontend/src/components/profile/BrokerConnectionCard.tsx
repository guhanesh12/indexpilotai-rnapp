import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { request } from '../../lib/api';
import { useBroker } from '../../broker/BrokerContext';
import { brokerStatusPath } from '../../broker/brokerPaths';
import { useTheme } from '../../contexts/ThemeContext';

const spacing = { base: 16, sm: 8, xs: 4 };
const radius = { xl: 16, lg: 12, md: 8, sm: 4, full: 9999 };
const cyan = '#00B4FF';

export default function BrokerConnectionCard() {
  const router = useRouter();
  const { theme: colors } = useTheme();
  const styles = getStyles(colors);
  const { activeBroker, activeBrokerName, chosen, connected, status: brokerStatus, refresh } = useBroker();
  const [brokerInfo, setBrokerInfo] = useState<{ clientId?: string | null; expiresAt?: string | null } | null>(null);

  useEffect(() => {
    if (!activeBroker || !chosen) {
      setBrokerInfo(null);
      return;
    }
    let alive = true;
    request('GET', brokerStatusPath(activeBroker))
      .then((res: any) => { if (alive) setBrokerInfo(res); })
      .catch(() => { if (alive) setBrokerInfo(null); });
    return () => { alive = false; };
  }, [activeBroker, chosen]);

  if (brokerStatus === 'loading') {
    return (
      <View style={styles.card}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={cyan} />
          <Text style={styles.loadingText}>Checking broker connection...</Text>
        </View>
      </View>
    );
  }

  const clientId = brokerInfo?.clientId;
  const displayName = activeBrokerName || activeBroker || 'Broker';

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="server-outline" size={20} color={connected ? '#34D399' : colors.text.secondary} />
        <Text style={styles.title}>Broker Connection</Text>
        {chosen ? (
          <View style={[styles.brokerBadge, { backgroundColor: connected ? 'rgba(52,211,153,0.15)' : 'rgba(255,51,68,0.15)' }]}>
            <Text style={{ color: connected ? '#34D399' : '#FF3344', fontSize: 10, fontWeight: '800' }}>
              {displayName}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: connected ? '#34D399' : '#FF3344' }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.statusLabel}>
            {chosen ? (connected ? 'Connected' : 'Not Connected') : 'No Broker Selected'}
          </Text>
          {connected && clientId ? (
            <Text style={styles.clientIdText}>Client ID: {clientId}</Text>
          ) : null}
          {!connected && chosen ? (
            <Text style={styles.hintText}>Connect {displayName} broker to enable trading</Text>
          ) : null}
          {!connected && !chosen ? (
            <Text style={styles.hintText}>Select a broker to start trading</Text>
          ) : null}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.connectBtn, connected && styles.disconnectBtn]}
        onPress={() => {
          router.push('/(tabs)/broker');
        }}
      >
         <Ionicons name={connected ? 'refresh-outline' : 'add-circle-outline'} size={16} color={connected ? colors.text.inverse : colors.text.primary} />
        <Text style={[styles.connectBtnText, connected && { color: colors.text.inverse }]}>
          {connected ? 'Manage Broker' : 'Connect Broker'}
        </Text>
      </TouchableOpacity>
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.base,
      gap: spacing.sm,
    },
    loadingText: {
      color: colors.text.secondary,
      fontSize: 13,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.base,
    },
    title: {
      color: colors.text.primary,
      fontSize: 16,
      fontWeight: '700',
      flex: 1,
    },
    brokerBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.full,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginBottom: spacing.base,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      backgroundColor: 'rgba(255,255,255,0.03)',
      borderRadius: radius.md,
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: radius.full,
      marginTop: 4,
    },
    statusLabel: {
      color: colors.text.primary,
      fontSize: 15,
      fontWeight: '600',
    },
    clientIdText: {
      color: '#00B4FF',
      fontSize: 12,
      marginTop: 2,
      fontWeight: '500',
    },
    hintText: {
      color: colors.text.secondary,
      fontSize: 12,
      marginTop: 4,
    },
    connectBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      backgroundColor: '#8B5CF6',
      borderRadius: radius.lg,
      paddingVertical: 12,
      marginTop: spacing.sm,
    },
    disconnectBtn: {
      backgroundColor: 'rgba(0,0,0,0.03)',
      borderWidth: 1,
      borderColor: colors.border.default,
    },
    connectBtnText: {
      color: colors.text.inverse,
      fontSize: 14,
      fontWeight: '700',
    },
  });
