import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, RefreshControl, View, ActivityIndicator, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/contexts/ThemeContext';
import { ThemeToggle } from '../../src/components/ThemeToggle';
import { ProfileThemeProvider, useProfileTheme } from '../../src/contexts/ProfileThemeContext';

import ProfileHeader from '../../src/components/profile/ProfileHeader';
import WalletCard from '../../src/components/profile/WalletCard';
import PersonalInfoCard from '../../src/components/profile/PersonalInfoCard';
import ReferralCard from '../../src/components/profile/ReferralCard';
import BrokerConnectionCard from '../../src/components/profile/BrokerConnectionCard';
import NotificationsCard from '../../src/components/profile/NotificationsCard';
import SecurityCard from '../../src/components/profile/SecurityCard';
import AboutCard from '../../src/components/profile/AboutCard';
import SupportCard from '../../src/components/profile/SupportCard';
import LogsCard from '../../src/components/profile/LogsCard';
import AccountSupportCard from '../../src/components/profile/AccountSupportCard';
import { useProfile, useWallet, useReferral } from '../../src/hooks/useProfileData';

function ProfileContent() {
  const { theme: colors, isDark, isLight } = useTheme();
  const { themeMode, setThemeMode, toggleTheme } = useProfileTheme();
  const spacing = { base: 16 };

  const [refreshing, setRefreshing] = useState(false);
  const { profile, loading: profileLoading, error: profileError, refresh: refreshProfile } = useProfile();
  const { wallet, loading: walletLoading, error: walletError, refresh: refreshWallet } = useWallet();
  const { code, earnings, referredUsers, loading: referralLoading, error: referralError, refresh: refreshReferral } = useReferral();

  const loading = profileLoading || walletLoading || referralLoading;
  const error = profileError || walletError || referralError;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshProfile(), refreshWallet(), refreshReferral()]);
    setRefreshing(false);
  }, [refreshProfile, refreshWallet, refreshReferral]);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
          <Text style={[styles.loadingText, { color: colors.text.secondary }]}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand.primary}
          />
        }
      >
        <View style={styles.themeToggleContainer}>
          <ThemeToggle showLabel={true} />
        </View>
        {error && <Text style={{color: colors.text.secondary, marginBottom: 16}}>{error}</Text>}
        <ProfileHeader profile={profile} loading={profileLoading} refresh={refreshProfile} />
        <WalletCard profile={profile} wallet={wallet} loading={walletLoading} />
        <ReferralCard code={code} earnings={earnings} referredUsers={referredUsers} loading={referralLoading} />
        <PersonalInfoCard profile={profile} />
        <BrokerConnectionCard />
        <SupportCard />
        <LogsCard />
        <NotificationsCard />
        <SecurityCard />
        <AboutCard />
        <AccountSupportCard />
      </ScrollView>
    </SafeAreaView>
  );
}

export default function ProfileScreen() {
  return (
    <ProfileThemeProvider>
      <ProfileContent />
    </ProfileThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  themeToggleContainer: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
  },
});
