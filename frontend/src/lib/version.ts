/**
 * IndexPilot AI - Version Manager
 * Centralized version management for the app
 * 
 * Version format: major.minor.patch
 */

// Current version - synced with app.json
export const APP_VERSION = '5.1.1';
export const APP_VERSION_CODE = 11;

// Version info type
export interface VersionInfo {
  version: string;
  versionCode: number;
  buildDate: string;
  minSupportedVersion?: string;
}

// Get current version info
export const getVersionInfo = (): VersionInfo => ({
  version: APP_VERSION,
  versionCode: APP_VERSION_CODE,
  buildDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
});

// Compare versions for update checking
export const isUpdateRequired = (
  currentVersion: string,
  minimumVersion: string
): boolean => {
  const current = currentVersion.split('.').map(Number);
  const minimum = minimumVersion.split('.').map(Number);
  
  for (let i = 0; i < 3; i++) {
    if (current[i] > minimum[i]) return false;
    if (current[i] < minimum[i]) return true;
  }
  return false;
};

// Parse version string to number for comparison
export const versionToNumber = (version: string): number => {
  const parts = version.split('.').map(Number);
  return parts[0] * 10000 + parts[1] * 100 + parts[2];
};

// Format version display
export const getVersionDisplay = (): string => `v${APP_VERSION}`;
