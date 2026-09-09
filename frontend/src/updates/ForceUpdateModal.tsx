import React, { useEffect } from 'react';
import {
  BackHandler,
  Image,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, spacing, typography } from '../lib/theme';

export type ForceUpdateInfo = {
  forceUpdate: boolean;
  title: string;
  message: string;
  currentVersion: string;
  latestVersion: string;
  storeUrl: string | null;
};

type Props = {
  visible: boolean;
  info: ForceUpdateInfo | null;
  onRequestClose?: () => void;
};

function openStore(url: string | null) {
  if (!url) return;
  Linking.openURL(url).catch(() => undefined);
}

export function ForceUpdateModal({
  visible,
  info,
  onRequestClose,
}: Props) {
  const forceUpdate = !!info?.forceUpdate;

  useEffect(() => {
    if (!visible) return;

    // forced: block hardware back
    if (!forceUpdate) return;

    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [visible, forceUpdate]);

  const handleRequestClose = () => {
    // When forced, user cannot dismiss.
    if (!forceUpdate) {
      // no-op (parent controls visible)
    }
  };

  if (!visible || !info) return null;

  const showLater = !forceUpdate;

  return (
    <Modal
      visible={true}
      animationType="fade"
      transparent={true}
      statusBarTranslucent={true}
      onRequestClose={handleRequestClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Image
              source={require('../../assets/logo/logo_app_icon.png')}
              style={styles.icon}
            />
          </View>

          <Text style={styles.title}>{info.title}</Text>
          <Text style={styles.message}>{info.message}</Text>

          <Text style={styles.versions}>
            Version {info.currentVersion} - Latest {info.latestVersion}
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.primaryButton]}
              onPress={() => openStore(info.storeUrl)}
              activeOpacity={0.9}
            >
              <Text style={styles.primaryButtonText}>Update Now</Text>
            </TouchableOpacity>

            {showLater && (
              <TouchableOpacity
                style={[styles.secondaryButton]}
                onPress={() => onRequestClose?.()}
                activeOpacity={0.9}
              >
                <Text style={styles.secondaryButtonText}>Later</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.lg,
    alignItems: 'center',
  },
  iconWrap: {
    marginBottom: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.bg.primary,
  },
  icon: {
    width: 64,
    height: 64,
    resizeMode: 'contain',
  },
  title: {
    ...(typography.h4 as any),
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    ...(typography.body as any),
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  versions: {
    ...(typography.bodySmall as any),
    color: colors.text.disabled,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  actions: {
    width: '100%',
    gap: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#061018',
    fontWeight: '800',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.focus,
  },
  secondaryButtonText: {
    color: colors.text.primary,
    fontWeight: '800',
    fontSize: 16,
  },
});
