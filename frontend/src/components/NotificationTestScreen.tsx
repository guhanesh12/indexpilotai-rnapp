/**
 * Notification Test Screen - For testing real push notifications on physical device
 * 
 * This component allows you to:
 * 1. Test all notification types with real screen popups
 * 2. Request notification permissions
 * 3. View FCM token
 * 4. Send test notifications via Notifee (real screen notifications)
 * 5. Simulate backend-triggered notifications
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  getFCMToken,
  sendTestLocalNotification,
  sendTestAllNotifications,
  displayForegroundNotification,
  registerPush,
  initializeFCM,
} from '../lib/push-fcm';
import { Storage } from '../lib/storage';
import { NotificationIcon } from './icons/AppIcons';

const CHANNEL_COLORS: Record<string, string> = {
  default: '#7C5CFF',
  signals: '#00FF66',
  orders: '#00B4FF',
  wallet: '#FFB800',
};

interface NotificationType {
  id: string;
  title: string;
  body: string;
  channel: string;
  emoji: string;
}

const NOTIFICATION_TYPES: NotificationType[] = [
  { id: 'signal', title: '📈 New AI Signal', body: 'BUY NIFTY 23500 CE - Target: ₹23,700', channel: 'signals', emoji: '📈' },
  { id: 'order_placed', title: '✅ Order Placed', body: 'Order #12345 placed successfully', channel: 'orders', emoji: '✅' },
  { id: 'order_executed', title: '✅ Order Executed', body: 'Order executed at ₹23,550', channel: 'orders', emoji: '🎯' },
  { id: 'wallet_recharge', title: '💰 Wallet Recharged', body: '₹5,000 added to your wallet', channel: 'wallet', emoji: '💰' },
  { id: 'signal_exit', title: '📊 Signal Exited', body: 'NIFTY signal exited with +₹1,250 profit', channel: 'signals', emoji: '📊' },
  { id: 'ticket', title: '🎫 Support Ticket', body: 'Ticket #9876 has been resolved', channel: 'default', emoji: '🎫' },
  { id: 'trade', title: '🎯 Trade Executed', body: 'BUY 1 lot NIFTY @ ₹23,500', channel: 'orders', emoji: '🎯' },
  { id: 'support', title: '💬 Support Update', body: 'Agent responded to your ticket', channel: 'default', emoji: '💬' },
  { id: 'low_balance', title: '⚠️ Low Balance', body: 'Your wallet balance is below ₹1,000', channel: 'wallet', emoji: '⚠️' },
  { id: 'alert', title: '🔔 Alert', body: 'Market is opening in 5 minutes', channel: 'default', emoji: '🔔' },
];

export function NotificationTestScreen() {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [statusText, setStatusText] = useState('Initializing...');
  const [lastNotification, setLastNotification] = useState<{title: string; body: string} | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load token on mount
  useEffect(() => {
    (async () => {
      try {
        setStatusText('Initializing FCM...');
        await initializeFCM();
        
        const token = await getFCMToken();
        if (token) {
          setFcmToken(token);
          setIsRegistered(true);
          setStatusText('✅ FCM Ready');
        } else {
          setStatusText('⚠️ No token - login first');
        }
      } catch (e: any) {
        setStatusText(`❌ Error: ${e?.message || 'Unknown'}`);
      }
    })();
  }, []);

  const handleSendSingle = useCallback(async (notif: NotificationType) => {
    setIsLoading(true);
    try {
      await displayForegroundNotification(
        notif.title,
        notif.body,
        { channel: notif.channel, type: notif.id },
        notif.channel
      );
      setLastNotification({ title: notif.title, body: notif.body });
      setStatusText(`✅ Sent: ${notif.title}`);
    } catch (e: any) {
      setStatusText(`❌ Error: ${e?.message}`);
    }
    setIsLoading(false);
  }, []);

  const handleSendAll = useCallback(async () => {
    setIsLoading(true);
    setStatusText('Sending all notifications...');
    await sendTestAllNotifications();
    setStatusText('✅ All notifications sent!');
    setIsLoading(false);
  }, []);

  const handleTestLocal = useCallback(async () => {
    setIsLoading(true);
    const success = await sendTestLocalNotification();
    setStatusText(success ? '✅ Test notification sent!' : '❌ Failed to send');
    setIsLoading(false);
  }, []);

  const handleCopyToken = useCallback(() => {
    if (fcmToken) {
      // Use Clipboard if available
      try {
        const Clipboard = require('expo-clipboard');
        Clipboard.setStringAsync(fcmToken);
        setStatusText('✅ Token copied to clipboard');
      } catch {
        setStatusText('📋 Token: ' + fcmToken.substring(0, 30) + '...');
      }
    }
  }, [fcmToken]);

  const handleRegister = useCallback(async () => {
    setIsLoading(true);
    setStatusText('Registering for push...');
    try {
      await registerPush('test-user', '');
      const token = await getFCMToken();
      if (token) {
        setFcmToken(token);
        setIsRegistered(true);
        setStatusText('✅ Registered successfully!');
      }
    } catch (e: any) {
      setStatusText(`❌ Registration error: ${e?.message}`);
    }
    setIsLoading(false);
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
       <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <NotificationIcon size={32} color="#FFD600" focused />
          <Text style={styles.headerTitle}>Push Notification Test</Text>
        </View>
        <Text style={styles.headerSubtitle}>Test real screen notifications on device</Text>
      </View>

      {/* Status */}
      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, isRegistered ? styles.dotGreen : styles.dotYellow]} />
          <Text style={styles.statusText}>{statusText}</Text>
        </View>
        {fcmToken && (
          <TouchableOpacity onPress={handleCopyToken}>
            <Text style={styles.tokenText} numberOfLines={2}>
              Token: {fcmToken.substring(0, 40)}...
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Last Notification */}
      {lastNotification && (
        <View style={styles.lastNotification}>
          <Text style={styles.lastNotifTitle}>Last Sent:</Text>
          <Text style={styles.lastNotifText}>
            {lastNotification.title}: {lastNotification.body}
          </Text>
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionButton, styles.actionPrimary]} onPress={handleTestLocal} disabled={isLoading}>
            <Text style={styles.actionButtonText}>🔔 Test One</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.actionSecondary]} onPress={handleSendAll} disabled={isLoading}>
            <Text style={styles.actionButtonText}>📨 Send All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.actionTertiary]} onPress={handleRegister} disabled={isLoading}>
            <Text style={styles.actionButtonText}>🔑 Register</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* All Notification Types */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notification Types</Text>
        <Text style={styles.sectionSubtitle}>Tap any to send a real screen notification</Text>
        
        {NOTIFICATION_TYPES.map((notif, index) => (
          <TouchableOpacity
            key={notif.id}
            style={[styles.notificationItem, { borderLeftColor: CHANNEL_COLORS[notif.channel] || '#7C5CFF' }]}
            onPress={() => handleSendSingle(notif)}
            disabled={isLoading}
          >
            <View style={styles.notifContent}>
              <Text style={styles.notifTitle}>{notif.title}</Text>
              <Text style={styles.notifBody}>{notif.body}</Text>
            </View>
            <View style={[styles.channelBadge, { backgroundColor: CHANNEL_COLORS[notif.channel] || '#7C5CFF' }]}>
              <Text style={styles.channelText}>{notif.channel}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#7C5CFF" />
          <Text style={styles.loadingText}>Sending...</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#888888',
  },
  statusCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A3E',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  dotGreen: {
    backgroundColor: '#00FF66',
  },
  dotYellow: {
    backgroundColor: '#FFB800',
  },
  statusText: {
    color: '#CCCCCC',
    fontSize: 14,
    flex: 1,
  },
  tokenText: {
    color: '#7C5CFF',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 4,
  },
  lastNotification: {
    backgroundColor: '#1A2E1A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A3E2A',
  },
  lastNotifTitle: {
    color: '#00FF66',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  lastNotifText: {
    color: '#CCCCCC',
    fontSize: 13,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPrimary: {
    backgroundColor: '#7C5CFF',
  },
  actionSecondary: {
    backgroundColor: '#2A2A3E',
  },
  actionTertiary: {
    backgroundColor: '#1A3A2E',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  notificationItem: {
    backgroundColor: '#1A1A2E',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#2A2A3E',
    flexDirection: 'row',
    alignItems: 'center',
  },
  notifContent: {
    flex: 1,
    marginRight: 12,
  },
  notifTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  notifBody: {
    fontSize: 12,
    color: '#AAAACC',
  },
  channelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  channelText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 12,
    fontSize: 14,
  },
});
