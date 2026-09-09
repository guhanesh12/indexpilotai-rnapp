import React, { ReactNode, useEffect } from 'react';
import { BackHandler, Image, Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing, typography } from '../lib/theme';

export type ForceUpdateStatus = 'ok' | 'optional' | 'force';

type Props = {
  visible: boolean;
  status: ForceUpdateStatus;
  title: string;
  message: string;
  onUpdate: () => void;
  onLater: () => void;
  storeUrl: string | null;
  children?: ReactNode;
};

export function ForceUpdateModal({
  visible,
  status,
  title,
  message,
  onUpdate,
  onLater,
  storeUrl,
  children,
}: Props) {
  const force = status === 'force';
  const optional = status === 'optional';

  useEffect(() => {
    if (!visible || !force) return;

    const handler = () => true; // non-dismissible
    const sub = BackHandler.addEventListener('hardwareBackPress', handler);

    return () => sub.remove();
  }, [visible, force]);

  const handleRequestClose = () => {
    // forced: blocked (do not close)
    if (optional) onLater();
  };

  if (!visible) return <>{children ?? null}</>;

  return (
    <>
      {children}
      <Modal
        visible={true}
        animationType="fade"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={handleRequestClose}
      >
        <View style={styles.overlay}>
          <View style={styles.center}>
            <View style={styles.card}>
              <View style={styles.iconWrap}>
                <Image
                  source={require('../../assets/logo/logo_app_icon.png')}
                  style={styles.icon}
                />
              </View>

              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{message}</Text>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.primaryButton]}
                  onPress={() => {
                    if (storeUrl) {
                      Linking.openURL(storeUrl).catch(() => {
                        // fail silently
                      });
                    }
                    onUpdate();
                  }}
                  activeOpacity={0.9}
                >
                  <Text style={styles.primaryButtonText}>Update</Text>
                </TouchableOpacity>

                {optional && (
                  <TouchableOpacity
                    style={[styles.secondaryButton]}
                    onPress={onLater}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.secondaryButtonText}>Later</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    width: '100%',
    paddingHorizontal: spacing.lg,
  },
  card: {
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
    marginBottom: spacing.md,
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
