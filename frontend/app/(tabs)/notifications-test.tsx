import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NotificationIcon } from '../../src/components/icons/AppIcons';
import { NotificationTestScreen } from '../../src/components/NotificationTestScreen';

export default function NotificationsTestRoute() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0F' }} edges={['top']}>
      <NotificationTestScreen />
    </SafeAreaView>
  );
}
