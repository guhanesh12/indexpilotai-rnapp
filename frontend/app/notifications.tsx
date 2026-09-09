import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import NotificationScreen from '../src/components/NotificationScreen';

export default function NotificationsPage() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0F' }} edges={['top']}>
      <NotificationScreen />
    </SafeAreaView>
  );
}
