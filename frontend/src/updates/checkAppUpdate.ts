import { Platform, Linking } from 'react-native';

const UPDATE_ENDPOINT =
  'https://oklgqelcaujxntgjyuis.supabase.co/functions/v1/mobile-version';

export type CheckAppUpdateInfo = {
  updateAvailable: boolean;
  forceUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  minimumVersion: string;
  storeUrl: string | null;
  title: string;
  message: string;
};

function isSemverString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * Compare semver strings like "a.b.c" using numeric segments.
 * Missing segments treated as 0. Non-numeric parts treated as 0.
 */
export function cmpVersion(a: string, b: string): -1 | 0 | 1 {
  const aParts = (a || '').split('.');
  const bParts = (b || '').split('.');

  const len = Math.max(aParts.length, bParts.length, 3);
  for (let i = 0; i < len; i++) {
    const ai = parseInt(aParts[i] ?? '0', 10);
    const bi = parseInt(bParts[i] ?? '0', 10);

    const av = Number.isFinite(ai) ? ai : 0;
    const bv = Number.isFinite(bi) ? bi : 0;

    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

function pickPlatformFields(response: any, platform: string) {
  if (platform === 'android') {
    return {
      currentVersion: response.androidCurrentVersion,
      minimumVersion: response.androidMinimumVersion,
      latestVersion: response.androidCurrentVersion,
      storeUrl: response.androidStoreUrl,
    };
  }

  return {
    currentVersion: response.iosCurrentVersion,
    minimumVersion: response.iosMinimumVersion,
    latestVersion: response.iosCurrentVersion,
    storeUrl: response.iosStoreUrl,
  };
}

/**
 * Force-update info via public HTTP polling.
 */
export async function checkAppUpdate(
  installedVersion: string
): Promise<CheckAppUpdateInfo> {
  try {
    const res = await fetch(UPDATE_ENDPOINT, { method: 'GET', cache: 'no-store' as any });
    if (!res.ok) {
      throw new Error(`Update endpoint failed: ${res.status}`);
    }

    const json = await res.json();

    const title = typeof json?.title === 'string' ? json.title : '';
    const message = typeof json?.message === 'string' ? json.message : '';

    const platformBlock = pickPlatformFields(json, Platform.OS);

    const currentVersion = isSemverString(installedVersion) ? installedVersion : '';
    const latestVersion = isSemverString(platformBlock.latestVersion) ? platformBlock.latestVersion : '';
    const minimumVersion = isSemverString(platformBlock.minimumVersion)
      ? platformBlock.minimumVersion
      : '';

    const storeUrl = typeof platformBlock.storeUrl === 'string' ? platformBlock.storeUrl : null;

    const updateAvailable =
      isSemverString(currentVersion) && isSemverString(latestVersion)
        ? cmpVersion(currentVersion, latestVersion) === -1
        : false;

    const forceBySemver =
      isSemverString(currentVersion) && isSemverString(minimumVersion)
        ? cmpVersion(currentVersion, minimumVersion) === -1
        : false;

    const forceUpdate = forceBySemver || json?.forceUpdate === true;

    return {
      updateAvailable,
      forceUpdate,
      currentVersion,
      latestVersion,
      minimumVersion,
      storeUrl,
      title,
      message,
    };
  } catch {
    // Fail open: treat as no update available.
    return {
      updateAvailable: false,
      forceUpdate: false,
      currentVersion: installedVersion,
      latestVersion: installedVersion,
      minimumVersion: installedVersion,
      storeUrl: null,
      title: '',
      message: '',
    };
  }
}

export async function openStore(url: string | null) {
  if (!url) return;
  await Linking.openURL(url);
}
