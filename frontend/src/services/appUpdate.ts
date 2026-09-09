import { Platform, Linking } from 'react-native';

export type AppUpdateStatus = 'ok' | 'optional' | 'force';

export type AppUpdateResponse = {
  status: AppUpdateStatus;
  storeUrl: string | null;
  title: string;
  message: string;
  latestVersion: string | null;
};

export type MobileVersionConfig = {
  androidCurrentVersion: string;
  androidMinimumVersion: string;
  androidStoreUrl: string;
  iosCurrentVersion: string;
  iosMinimumVersion: string;
  iosStoreUrl: string;
  forceUpdate: boolean;

  title: string;
  message: string;
};

const UPDATE_ENDPOINT =
  'https://api.indexpilotai.com/functions/v1/mobile-version';

function isSemverString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function pickPlatformBlock(config: MobileVersionConfig, platform: string) {
  if (platform === 'android') {
    return {
      currentVersion: config.androidCurrentVersion,
      minimumVersion: config.androidMinimumVersion,
      storeUrl: config.androidStoreUrl,
    };
  }
  return {
    currentVersion: config.iosCurrentVersion,
    minimumVersion: config.iosMinimumVersion,
    storeUrl: config.iosStoreUrl,
  };
}

/**
 * Compare semver strings like "a.b.c" using numeric segments.
 * Missing segments treated as 0. Non-numeric parts treated as 0.
 */
export function cmpSemver(a: string, b: string): -1 | 0 | 1 {
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

/**
 * Fetch update configuration from backend.
 * Uses `cache: 'no-store'` as requested.
 */
export async function fetchAppVersion(): Promise<MobileVersionConfig | null> {
  const res = await fetch(UPDATE_ENDPOINT, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!res.ok) return null;

  const json = (await res.json()) as Partial<MobileVersionConfig>;

  const title = typeof json.title === 'string' ? json.title : '';
  const message = typeof json.message === 'string' ? json.message : '';

  if (!title || !message) return null;

  const forceUpdate = json.forceUpdate === true;

  const candidates = {
    androidCurrentVersion: json.androidCurrentVersion,
    androidMinimumVersion: json.androidMinimumVersion,
    androidStoreUrl: json.androidStoreUrl,
    iosCurrentVersion: json.iosCurrentVersion,
    iosMinimumVersion: json.iosMinimumVersion,
    iosStoreUrl: json.iosStoreUrl,
  };

  // Require all platform fields to be present and non-empty.
  if (
    !isSemverString(candidates.androidCurrentVersion) ||
    !isSemverString(candidates.androidMinimumVersion) ||
    !isSemverString(candidates.iosCurrentVersion) ||
    !isSemverString(candidates.iosMinimumVersion) ||
    typeof candidates.androidStoreUrl !== 'string' ||
    typeof candidates.iosStoreUrl !== 'string'
  ) {
    return null;
  }

  return {
    androidCurrentVersion: candidates.androidCurrentVersion as string,
    androidMinimumVersion: candidates.androidMinimumVersion as string,
    androidStoreUrl: candidates.androidStoreUrl as string,
    iosCurrentVersion: candidates.iosCurrentVersion as string,
    iosMinimumVersion: candidates.iosMinimumVersion as string,
    iosStoreUrl: candidates.iosStoreUrl as string,
    forceUpdate,
    title,
    message,
  };
}

function statusForVersions(params: {
  installedVersion: string;
  currentVersion: string;
  minimumVersion: string;
  forceUpdate: boolean;
}): AppUpdateStatus {
  const installedVsMinimum = cmpSemver(params.installedVersion, params.minimumVersion); // -1 if installed < minimum
  if (installedVsMinimum === -1) return 'force';

  const installedVsCurrent = cmpSemver(params.installedVersion, params.currentVersion); // -1 if installed < current
  if (installedVsCurrent === -1) return params.forceUpdate ? 'force' : 'optional';

  return 'ok';
}

/**
 * Check if an update prompt should be shown.
 * - force when installed < minimum OR forceUpdate === true AND installed < current
 * - optional when installed < current
 */
export async function checkAppUpdate(
  installedVersion?: string | null,
  platform?: string
): Promise<AppUpdateResponse> {
  const config = await fetchAppVersion();

  if (!config) {
    return {
      status: 'ok',
      storeUrl: null,
      title: '',
      message: '',
      latestVersion: null,
    };
  }

  const resolvedPlatform = platform ?? Platform.OS;

  const platformBlock = pickPlatformBlock(config, resolvedPlatform);

  const latestVersion = platformBlock.currentVersion;

  if (!installedVersion || !isSemverString(installedVersion)) {
    return {
      status: 'ok',
      storeUrl: platformBlock.storeUrl,
      title: config.title,
      message: config.message,
      latestVersion,
    };
  }

  const status = statusForVersions({
    installedVersion,
    currentVersion: platformBlock.currentVersion,
    minimumVersion: platformBlock.minimumVersion,
    forceUpdate: config.forceUpdate,
  });

  return {
    status,
    storeUrl: platformBlock.storeUrl,
    title: config.title,
    message: config.message,
    latestVersion,
  };
}

// Utility for app UI
export async function openStore(storeUrl: string | null) {
  if (!storeUrl) return;
  await Linking.openURL(storeUrl);
}
