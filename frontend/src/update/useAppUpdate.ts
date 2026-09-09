import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as Application from 'expo-application';

export type UpdateStatus = 'ok' | 'optional' | 'forced';

export type MobileVersionConfig = {
  title: string;
  message: string;
  forceUpdate?: boolean;

  androidCurrentVersion?: string;
  androidMinimumVersion?: string;
  androidStoreUrl?: string;

  iosCurrentVersion?: string;
  iosMinimumVersion?: string;
  iosStoreUrl?: string;
};

export type UseAppUpdateResult = {
  status: UpdateStatus;
  config: MobileVersionConfig | null;
  installed: string | null;
};

/**
 * Compare semver strings like "1.2.3" using numeric segments.
 * - Splits by "."
 * - Missing segments treated as 0
 * - Non-numeric parts are treated as 0
 */
function compareSemver(a: string, b: string): -1 | 0 | 1 {
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

function isSemverString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await new Promise<T>((resolve, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
      promise.then(resolve).catch(reject);
    });
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function fetchMobileVersionConfig(): Promise<MobileVersionConfig | null> {
  const url =
    'https://oklgqelcaujxntgjyuis.supabase.co/functions/v1/mobile-version';

  try {
    const res = await withTimeout(fetch(url, { method: 'GET' }), 5000);
    if (!res.ok) return null;
    const json = (await res.json()) as MobileVersionConfig;

    // Minimal shape sanity check
    if (!json || !isSemverString((Platform.OS === 'android' ? json.androidCurrentVersion : json.iosCurrentVersion) as any)) {
      // still allow, as status logic depends on versions existing; fail-open elsewhere if needed
    }
    return json;
  } catch {
    return null; // fail-open
  }
}

function pickPlatformBlock(config: MobileVersionConfig) {
  if (Platform.OS === 'android') {
    return {
      currentVersion: config.androidCurrentVersion ?? null,
      minimumVersion: config.androidMinimumVersion ?? null,
      storeUrl: config.androidStoreUrl ?? null,
    };
  }
  return {
    currentVersion: config.iosCurrentVersion ?? null,
    minimumVersion: config.iosMinimumVersion ?? null,
    storeUrl: config.iosStoreUrl ?? null,
  };
}

export function useAppUpdate(): UseAppUpdateResult {
  const [status, setStatus] = useState<UpdateStatus>('ok');
  const [config, setConfig] = useState<MobileVersionConfig | null>(null);
  const [installed, setInstalled] = useState<string | null>(null);

  const lastComputedRef = useRef<{
    installed: string | null;
    configHash: string | null;
  }>({ installed: null, configHash: null });

  const computeAndSet = useMemo(() => {
    return async () => {
      // Fail-open on any API failure. If API returns null, status remains ok.
      const apiConfig = await fetchMobileVersionConfig();
      if (!apiConfig) {
        setConfig(null);
        setStatus('ok');
        return;
      }

      const version = await (async () => {
        try {
          // expo-application is supported in Expo Go and production builds
          return Application.nativeApplicationVersion || Application.nativeBuildVersion || null;
        } catch {
          return null;
        }
      })();

      setInstalled(version);

      const platformBlock = pickPlatformBlock(apiConfig);

      const installedV = version;
      const currentV = platformBlock.currentVersion;
      const minimumV = platformBlock.minimumVersion;

      // If we cannot determine versions, fail-open.
      if (!installedV || !currentV || !minimumV) {
        setConfig(apiConfig);
        setStatus('ok');
        return;
      }

      // Proper semver comparison
      const installedVsMinimum = compareSemver(installedV, minimumV); // -1 if installed < minimum
      const installedVsCurrent = compareSemver(installedV, currentV); // -1 if installed < current

      const forceUpdate = apiConfig.forceUpdate === true;

      let nextStatus: UpdateStatus = 'ok';
      if (installedVsMinimum === -1) {
        nextStatus = 'forced';
      } else if (installedVsCurrent === -1) {
        nextStatus = forceUpdate ? 'forced' : 'optional';
      } else {
        nextStatus = 'ok';
      }

      const configHash = JSON.stringify({
        forceUpdate: apiConfig.forceUpdate ?? null,
        title: apiConfig.title,
        message: apiConfig.message,
        ...pickPlatformBlock(apiConfig),
      });

      const prev = lastComputedRef.current;
      if (prev.installed === installedV && prev.configHash === configHash) {
        // No-op; avoids unnecessary renders
        return;
      }
      lastComputedRef.current = { installed: installedV, configHash };

      setConfig(apiConfig);
      setStatus(nextStatus);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      if (!isMounted) return;
      await computeAndSet();
    })();

    const sub = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (!isMounted) return;
      if (nextState === 'active') {
        await computeAndSet();
      }
    });

    return () => {
      isMounted = false;
      sub.remove();
    };
  }, [computeAndSet]);

  return { status, config, installed };
}
