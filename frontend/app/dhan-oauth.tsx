import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { colors, spacing, radius, typography } from '../src/lib/theme';
import { api } from '../src/lib/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function DhanOAuthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { clientId, apiKey, apiSecret } = useLocalSearchParams<{
    clientId: string;
    apiKey: string;
    apiSecret: string;
  }>();

  const [step, setStep] = useState<'loading' | 'consent' | 'login' | 'success' | 'error'>('loading');
  const [consentId, setConsentId] = useState<string | null>(null);
  const [tokenId, setTokenId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState('Preparing...');

  const webViewRef = useRef<WebView>(null);

  // Step 1: Generate consent
  useEffect(() => {
    generateConsent();
  }, []);

  const generateConsent = async () => {
    setStep('loading');
    setLoadingMsg('Generating consent...');

    try {
      console.log('[Dhan OAuth] Generating consent with:', { clientId, apiKey: apiKey?.slice(0, 10) });

      const res: any = await api.generateDhanConsent({
        clientId,
        apiKey,
        apiSecret,
      });

      console.log('[Dhan OAuth] Consent response:', res);

      if (res?.consentAppId) {
        setConsentId(res.consentAppId);
        setStep('login');
        setLoadingMsg('Opening Dhan login...');
      } else {
        throw new Error(res?.error || res?.message || 'Failed to generate consent');
      }
    } catch (e: any) {
      console.error('[Dhan OAuth] Consent error:', e);
      setStep('error');
      // Show detailed error for debugging
      const errorDetail = e?.message || e?.error || JSON.stringify(e) || 'Unknown error';
      Alert.alert(
        'Consent Failed',
        errorDetail + '\n\nPlease check your API Key/Secret are correct from Dhan dashboard.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  };

  // Handle WebView navigation
  const handleNavigationStateChange = (navState: any) => {
    const url = navState.url || '';

    // Check for redirect with tokenId
    if (url.includes('tokenId=')) {
      const match = url.match(/tokenId=([^&]+)/);
      if (match && match[1]) {
        console.log('[Dhan OAuth] Got tokenId:', match[1]);
        setTokenId(match[1]);
        // Stop further navigation
        webViewRef.current?.stopLoading();
        // Consume the consent
        consumeConsent(match[1]);
      }
    }
  };

  // Step 3: Consume consent to get access token
  const consumeConsent = async (tid: string) => {
    if (!tid) return;

    setStep('loading');
    setLoadingMsg('Getting access token...');

    try {
      console.log('[Dhan OAuth] Consuming consent:', tid);

      const res: any = await api.consumeDhanConsent({
        tokenId: tid,
        apiKey,
        apiSecret,
      });

      console.log('[Dhan OAuth] Token response:', res);

      if (res?.accessToken) {
        setAccessToken(res.accessToken);
        setStep('success');

        // Return to broker tab with token
        Alert.alert(
          '🎉 Token Generated!',
          `Access token received (valid for 12 months)\n\nReturning to broker connection...`,
          [
            {
              text: 'Continue',
              onPress: () => {
                router.replace({
                  pathname: '/(tabs)/broker',
                  params: {
                    token: res.accessToken,
                    autoConnect: 'true',
                  },
                });
              },
            },
          ]
        );
      } else {
        throw new Error(res?.error || res?.message || 'Failed to get access token');
      }
    } catch (e: any) {
      console.error('[Dhan OAuth] Consume error:', e);
      setStep('error');
      Alert.alert(
        'Token Failed',
        e.message || 'Could not get access token. Please try again.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  // Login URL
  const loginUrl = consentId
    ? `https://auth.dhan.co/login/consentApp-login?consentAppId=${consentId}`
    : '';

  // Render loading state
  if (step === 'loading') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Get Dhan Token</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7C5CFF" />
          <Text style={styles.loadingMsg}>{loadingMsg}</Text>
          <Text style={styles.loadingSubtext}>
            This may take a few seconds...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render error state
  if (step === 'error') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Get Dhan Token</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#FF4040" />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>
            Please check your API Key and Secret, then try again.
          </Text>
          <TouchableOpacity onPress={handleGoBack} style={styles.errorBtn}>
            <Text style={styles.errorBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Render success state (briefly)
  if (step === 'success') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Success!</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.loadingContainer}>
          <Ionicons name="checkmark-circle" size={64} color={colors.trading.profit} />
          <Text style={styles.loadingMsg}>Token Generated!</Text>
          <Text style={styles.loadingSubtext}>
            Returning to broker connection...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render WebView login
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Login to Dhan</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionsText}>
          1. Login with your Dhan credentials{' '}
        </Text>
        <Text style={styles.instructionsText}>
          2. Complete 2FA verification{' '}
        </Text>
        <Text style={styles.instructionsText}>
          3. We'll automatically get your token
        </Text>
      </View>

      {/* WebView */}
      <WebView
        ref={webViewRef}
        source={{ uri: loginUrl }}
        style={styles.webView}
        onLoadStart={() => setLoadingMsg('Loading Dhan...')}
        onNavigationStateChange={handleNavigationStateChange}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        cacheEnabled={true}
        mixedContentMode="always"
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={(request: any) => {
          return true;
        }}
      />

      {/* Loading overlay */}
      {step === 'login' && (
        <View style={styles.loginOverlay}>
          <ActivityIndicator size="small" color="#7C5CFF" />
          <Text style={styles.loginOverlayText}>Waiting for login...</Text>
        </View>
      )}

      {/* Bottom padding */}
      <View style={{ height: insets.bottom, backgroundColor: colors.bg.primary }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  headerTitle: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  instructions: {
    padding: spacing.base,
    backgroundColor: colors.bg.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  instructionsText: {
    color: colors.text.secondary,
    fontSize: 13,
    marginBottom: 4,
  },
  webView: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingMsg: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '600',
    marginTop: spacing.base,
  },
  loadingSubtext: {
    color: colors.text.secondary,
    fontSize: 14,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorTitle: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '600',
    marginTop: spacing.base,
  },
  errorText: {
    color: colors.text.secondary,
    fontSize: 14,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  errorBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.xl,
    backgroundColor: '#7C5CFF',
    borderRadius: radius.md,
  },
  errorBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  loginOverlay: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: spacing.base,
    backgroundColor: 'rgba(124, 92, 255, 0.9)',
  },
  loginOverlayText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
