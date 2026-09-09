import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { colors, spacing } from '../src/lib/theme';

export default function DhanTokenScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Get Dhan Access Token</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.instructions}>
        <Text style={styles.instructionsText}>1. Log in to your Dhan account</Text>
        <Text style={styles.instructionsText}>2. Go to My Profile → Access DhanHQ APIs</Text>
        <Text style={styles.instructionsText}>3. Copy the Access Token (valid ~24 hours)</Text>
        <Text style={styles.instructionsText}>4. Return here and paste it in the broker screen</Text>
      </View>

      <View style={styles.webviewWrap}>
        {loading && (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#7C5CFF" />
            <Text style={styles.loaderText}>Loading Dhan...</Text>
          </View>
        )}
        <WebView
          source={{ uri: 'https://web.dhan.co/index/profile' }}
          style={styles.webView}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          scalesPageToFit
          cacheEnabled
          mixedContentMode="always"
          originWhitelist={['*']}
        />
      </View>

      <View style={{ height: insets.bottom }} />
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
  webviewWrap: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  loader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.primary,
    zIndex: 1,
  },
  loaderText: {
    color: colors.text.primary,
    marginTop: spacing.base,
    fontSize: 16,
    fontWeight: '600',
  },
});
