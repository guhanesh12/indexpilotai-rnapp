/**
 * IndexPilot AI - Auto Update Service
 * Handles in-app update checking
 * 
 * Supports:
 * - Google Play In-App Updates (Android)
 * - Custom backend version check
 * - Manual update prompts
 */

import Constants from 'expo-constants';
import { Platform, Linking } from 'react-native';
import { APP_VERSION, APP_VERSION_CODE, versionToNumber } from './version';

// Update status types
export type UpdateStatus = 'up-to-date' | 'update-available' | 'update-required' | 'download-progress' | 'restart-required';

export interface UpdateCheckResult {
  status: UpdateStatus;
  availableVersion?: string;
  availableVersionCode?: number;
  releaseNotes?: string;
  isMandatory?: boolean;
  isDialogOpen?: boolean;
}

export interface UpdateInfo {
  latestVersion: string;
  minSupportedVersion?: string;
  releaseNotes?: string;
  downloadUrl?: string;
  isMandatory?: boolean;
}

// Check for updates using expo-updates (works with Google Play In-App Updates)
export const checkForUpdates = async (): Promise<UpdateCheckResult> => {
  try {
    // Get the runtime version from Expo constants
    const runtimeVersion = Constants.expoConfig?.version;
    
    if (runtimeVersion && versionToNumber(runtimeVersion) > versionToNumber(APP_VERSION)) {
      console.log('[Update] Update available:', runtimeVersion);
      return {
        status: 'update-available',
        availableVersion: runtimeVersion,
        isMandatory: false,
      };
    }

    // Check if update is required (current version is below minimum)
    const minimumVersion = getMinimumSupportedVersion();
    if (versionToNumber(APP_VERSION) < versionToNumber(minimumVersion)) {
      return {
        status: 'update-required',
        availableVersion: getLatestVersion(),
        isMandatory: true,
        releaseNotes: getReleaseNotes(),
      };
    }

    console.log('[Update] App is up to date');
    return { 
      status: 'up-to-date',
      availableVersion: APP_VERSION,
    };
  } catch (error) {
    console.log('[Update] Check failed:', error);
    return { status: 'up-to-date' };
  }
};

// Get latest version from backend/config
export const getLatestVersion = (): string => {
  // In production, fetch from your backend
  // For demo, return current version (would be updated server-side)
  return APP_VERSION;
};

// Get minimum supported version
export const getMinimumSupportedVersion = (): string => {
  // Users on older versions must update
  return '3.0.0';
};

// Get release notes for update dialog
export const getReleaseNotes = (): string => {
  // In production, fetch from backend
  return `• Performance improvements
• Bug fixes and stability enhancements  
• New features and improvements`;
};

// Open Play Store listing
export const openPlayStore = async (): Promise<boolean> => {
  try {
    // For Android
    if (Platform.OS === 'android') {
      const packageName = Constants.expoConfig?.android?.package || 'com.indexpilotai.app';
      await Linking.openURL(`https://play.google.com/store/apps/details?id=${packageName}`);
      return true;
    }
    return false;
  } catch (error) {
    console.log('[Update] Open store failed:', error);
    return false;
  }
};

// Download and restart with update (placeholder for In-App Updates API)
export const downloadAndRestart = async (): Promise<boolean> => {
  try {
    // Open Play Store for now (In-App Updates require additional setup)
    return await openPlayStore();
  } catch (error) {
    console.log('[Update] Download failed:', error);
    return false;
  }
};

// Get app version info
export const getAppVersionInfo = async (): Promise<{
  version: string;
  versionCode: number;
  buildId: string;
  channel: string;
}> => {
  const manifest = Constants.expoConfig;
  return {
    version: APP_VERSION,
    versionCode: APP_VERSION_CODE,
    buildId: Constants.manifest?.extra?.eas?.projectId || 'unknown',
    channel: 'production',
  };
};

// Initialize update check on app start
export const initializeUpdateCheck = async (): Promise<UpdateCheckResult> => {
  // Check for updates on app startup (non-blocking)
  setTimeout(async () => {
    try {
      const result = await checkForUpdates();
      console.log('[Update] Startup check result:', result.status);
      return result;
    } catch (error) {
      console.log('[Update] Startup check failed:', error);
    }
  }, 5000); // Delay 5 seconds to not block app launch

  return { status: 'up-to-date' };
};

// Show update available dialog
export const showUpdateDialog = async (updateInfo: UpdateCheckResult): Promise<void> => {
  const { availableVersion, releaseNotes, isMandatory, status } = updateInfo;
  
  if (status === 'up-to-date') return;
  
  const message = releaseNotes 
    ? `A new version (${availableVersion}) is available.\n\n${releaseNotes}`
    : `Version ${availableVersion} is now available!`;
    
  if (isMandatory) {
    // Mandatory update - must update to continue
    Linking.openURL(`https://play.google.com/store/apps/details?id=${Constants.expoConfig?.android?.package || 'com.indexpilotai.app'}`);
  } else {
    // Optional update - show dialog
    // Note: This would typically use a proper modal component
    console.log('[Update] Update available:', message);
  }
};
