// src/lib/fingerprint.ts
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

/**
 * Check if fingerprint/biometric hardware is available AND the user has enrolled credentials.
 * Returns true only when the user can actually authenticate with biometrics.
 */
export async function isFingerprintAvailable(): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return enrolled;
  } catch (e) {
    console.warn('[Fingerprint] Availability check failed:', e);
    return false;
  }
}

export type FingerprintResult = 'success' | 'failed' | 'cancelled' | 'not-available';

/**
 * Prompt the user for fingerprint/biometric authentication.
 * Uses disableDeviceFallback so the system dialog does NOT fall back to
 * device PIN/pattern/password — if the user cancels or fails, we handle
 * the fallback to the app PIN ourselves.
 */
export async function promptFingerprint(): Promise<FingerprintResult> {
  try {
    const available = await isFingerprintAvailable();
    if (!available) return 'not-available';

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock IndexPilot AI',
      disableDeviceFallback: true,
      cancelLabel: 'Cancel',
    });

    if (result.success) return 'success';
    if (result.error === 'user_cancel' || result.error === 'user_fallback') return 'cancelled';
    return 'failed';
  } catch (e) {
    console.warn('[Fingerprint] Prompt failed:', e);
    return 'failed';
  }
}

/**
 * Try fingerprint authentication with up to 3 attempts.
 * - On success → returns 'success'
 * - On cancel → returns 'cancelled' (immediately, no retry)
 * - On 3 failed attempts → returns 'failed'
 * - If not available → returns 'not-available'
 */
export async function tryFingerprintWithRetries(
  maxAttempts: number = 3
): Promise<FingerprintResult> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;
    const result = await promptFingerprint();

    if (result === 'success') return 'success';
    if (result === 'cancelled') return 'cancelled';
    if (result === 'not-available') return 'not-available';

    // result === 'failed' → retry if attempts remain
    if (attempts >= maxAttempts) return 'failed';
  }

  return 'failed';
}
