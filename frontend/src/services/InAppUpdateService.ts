/**
 * IndexPilot AI - Google Play In-App Update Service
 * 
 * Provides in-app update functionality for Android Play Store releases.
 * Supports both Flexible and Immediate update modes.
 * 
 * Important: This implementation ONLY works when:
 * - App is installed from Google Play Store
 * - App is released as AAB (Android App Bundle)
 * - App uses internal testing or production release tracks
 * 
 * @platform Android
 * @requires Play Core SDK 1.8.1+
 */

import { NativeModules, Platform, Linking, Alert, LogBox } from 'react-native';
import { APP_VERSION, APP_VERSION_CODE, getVersionInfo } from '../lib/version';

// Suppress known warnings for cleaner logs during development
LogBox.ignoreLogs([
  'Non-native method called before native module initialization',
]);

// ============================================================================
// Types
// ============================================================================

export enum UpdateType {
  FLEXIBLE = 'FLEXIBLE',
  IMMEDIATE = 'IMMEDIATE',
}

export enum UpdateAvailability {
  UNKNOWN = 0,
  UPDATE_AVAILABLE = 1,
  UPDATE_NOT_AVAILABLE = 2,
  UPDATE_DEVELOPER_TRIGGERED = 3,
}

export interface InAppUpdateInfo {
  isUpdateAvailable: boolean;
  isUpdateStarted: boolean;
  updateAvailability: UpdateAvailability;
  packageVersionCode?: number;
  availableVersionCode?: number;
  updateType?: UpdateType;
  installStatus?: string;
}

export interface InAppUpdateResult {
  success: boolean;
  error?: string;
  shouldInstall?: boolean;
  needsUserConfirmation?: boolean;
}

// ============================================================================
// Native Module Interface
// ============================================================================

interface InAppUpdateModuleInterface {
  /**
   * Check if an update is available from the Play Store
   * @returns Promise resolving to update info JSON string
   */
  checkForUpdate(): Promise<string>;
  
  /**
   * Start a flexible update download
   * @returns Promise resolving to result JSON string
   */
  startFlexibleUpdate(): Promise<string>;
  
  /**
   * Start an immediate (blocking) update
   * @returns Promise resolving to result JSON string
   */
  startImmediateUpdate(): Promise<string>;
  
  /**
   * Get the current app installation source
   * @returns Promise with installation info
   */
  getAppInstallInfo(): Promise<string>;
  
  /**
   * Complete flexible update installation
   * @returns Promise resolving to result
   */
  completeUpdate(): Promise<string>;
  
  /**
   * Check if app was downloaded from Play Store
   * @returns Promise resolving to boolean
   */
  isPlayStoreInstall(): Promise<boolean>;
}

const { InAppUpdateModule } = NativeModules as {
  InAppUpdateModule?: InAppUpdateModuleInterface;
};

// ============================================================================
// Service Implementation
// ============================================================================

class InAppUpdateServiceClass {
  private isInitialized: boolean = false;
  private isUpdateCheckInProgress: boolean = false;
  private lastUpdateCheck: InAppUpdateInfo | null = null;
  // Using number for React Native/Node.js compatibility (setInterval returns number on RN)
  private updateCheckInterval: ReturnType<typeof setInterval> | null = null;
  
  /**
   * Initialize the update service
   * Call this on app startup to set up automatic update checking
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[InAppUpdate] Already initialized');
      return;
    }
    
    console.log('[InAppUpdate] Initializing service...');
    console.log('[InAppUpdate] Platform:', Platform.OS);
    console.log('[InAppUpdate] App Version:', APP_VERSION);
    console.log('[InAppUpdate] Version Code:', APP_VERSION_CODE);
    
    // Check if running on a supported platform
    if (Platform.OS !== 'android') {
      console.log('[InAppUpdate] Platform not supported:', Platform.OS);
      console.log('[InAppUpdate] In-app updates are Android/Play Store only');
      this.isInitialized = true;
      return;
    }
    
    // Check if native module is available
    if (!InAppUpdateModule) {
      console.warn('[InAppUpdate] Native module not available');
      console.warn('[InAppUpdate] This is expected in:');
      console.warn('[InAppUpdate]   - Expo Go preview');
      console.warn('[InAppUpdate]   - Debug builds');
      console.warn('[InAppUpdate]   - Test builds (not from Play Store)');
      
      // Still mark as initialized - we'll handle gracefully
      this.isInitialized = true;
      return;
    }
    
    // Verify Play Store installation
    await this.verifyPlayStoreInstallation();
    
    this.isInitialized = true;
    console.log('[InAppUpdate] Service initialized successfully');
  }
  
  /**
   * Verify if app was installed from Play Store
   */
  private async verifyPlayStoreInstallation(): Promise<boolean> {
    if (!InAppUpdateModule) {
      return false;
    }
    
    try {
      const isPlayStore = await InAppUpdateModule.isPlayStoreInstall();
      console.log('[InAppUpdate] Play Store install:', isPlayStore);
      
      if (!isPlayStore) {
        console.warn('[InAppUpdate] NOT a Play Store installation');
        console.warn('[InAppUpdate] In-app updates require:');
        console.warn('[InAppUpdate]   - Release build from Play Store');
        console.warn('[InAppUpdate]   - Published to Internal/Production track');
      }
      
      return isPlayStore;
    } catch (error) {
      console.error('[InAppUpdate] Install check failed:', error);
      return false;
    }
  }
  
  /**
   * Check for available updates
   * Call this when the app starts or resumes
   */
  async checkForUpdates(): Promise<InAppUpdateInfo> {
    // Prevent concurrent checks
    if (this.isUpdateCheckInProgress) {
      console.log('[InAppUpdate] Update check already in progress');
      return this.lastUpdateCheck || {
        isUpdateAvailable: false,
        isUpdateStarted: false,
        updateAvailability: UpdateAvailability.UNKNOWN,
      };
    }
    
    this.isUpdateCheckInProgress = true;
    
    console.log('[InAppUpdate] ======================================');
    console.log('[InAppUpdate] Checking for updates...');
    console.log('[InAppUpdate] Current version:', APP_VERSION);
    console.log('[InAppUpdate] ======================================');
    
    let result: InAppUpdateInfo = {
      isUpdateAvailable: false,
      isUpdateStarted: false,
      updateAvailability: UpdateAvailability.UNKNOWN,
    };
    
    // Handle non-Android platforms
    if (Platform.OS !== 'android') {
      console.log('[InAppUpdate] Not Android - skipping update check');
      this.isUpdateCheckInProgress = false;
      return result;
    }
    
    // Handle missing native module
    if (!InAppUpdateModule) {
      console.log('[InAppUpdate] Native module not available');
      console.log('[InAppUpdate] Update checks only work in:');
      console.log('[InAppUpdate]   - Release builds (expo run:android --variant release)');
      console.log('[InAppUpdate]   - Built APKs from Play Store');
      this.isUpdateCheckInProgress = false;
      return result;
    }
    
    try {
      // Call native module to check for updates
      const response = await InAppUpdateModule.checkForUpdate();
      const updateInfo = JSON.parse(response) as InAppUpdateInfo;
      
      console.log('[InAppUpdate] Update check result:');
      console.log('[InAppUpdate]   - Available:', updateInfo.isUpdateAvailable);
      console.log('[InAppUpdate]   - Current version code:', updateInfo.packageVersionCode);
      console.log('[InAppUpdate]   - Available version code:', updateInfo.availableVersionCode);
      
      // Store result
      this.lastUpdateCheck = updateInfo;
      result = updateInfo;
      
      if (updateInfo.isUpdateAvailable) {
        console.log('[InAppUpdate] 🎉 UPDATE AVAILABLE!');
        console.log('[InAppUpdate]   - Available version code:', updateInfo.availableVersionCode);
        console.log('[InAppUpdate]   - Update type:', updateInfo.updateType || 'FLEXIBLE');
      } else {
        console.log('[InAppUpdate] App is up to date ✓');
      }
      
    } catch (error: any) {
      console.error('[InAppUpdate] Update check failed:', error.message || error);
      console.error('[InAppUpdate] Error details:', error);
    }
    
    this.isUpdateCheckInProgress = false;
    return result;
  }
  
  /**
   * Start a FLEXIBLE update
   * - User can continue using the app while update downloads
   * - User is prompted to restart to install
   * - Use for non-critical updates
   */
  async startFlexibleUpdate(): Promise<InAppUpdateResult> {
    console.log('[InAppUpdate] Starting FLEXIBLE update...');
    console.log('[InAppUpdate] User can continue using the app');
    
    if (!InAppUpdateModule) {
      return this.openPlayStoreFallback('Flexible update not available');
    }
    
    try {
      const response = await InAppUpdateModule.startFlexibleUpdate();
      const result = JSON.parse(response) as InAppUpdateResult;
      
      if (result.success) {
        console.log('[InAppUpdate] Flexible update started ✓');
        console.log('[InAppUpdate] Download in progress...');
        
        // Show user a message
        Alert.alert(
          'Update Started',
          'A new version is downloading in the background. You can continue using the app.',
          [{ text: 'Continue', style: 'default' }]
        );
      } else {
        console.error('[InAppUpdate] Flexible update failed:', result.error);
        return this.openPlayStoreFallback(result.error || 'Update failed');
      }
      
      return result;
    } catch (error: any) {
      console.error('[InAppUpdate] Flexible update error:', error.message || error);
      return this.openPlayStoreFallback(error.message || 'Update error');
    }
  }
  
  /**
   * Start an IMMEDIATE update
   * - User MUST update before using the app
   * - Google Play update dialog blocks all interaction
   * - Use for critical security/critical updates
   */
  async startImmediateUpdate(): Promise<InAppUpdateResult> {
    console.log('[InAppUpdate] Starting IMMEDIATE update...');
    console.log('[InAppUpdate] ⚠️ User will be blocked until update completes');
    
    if (!InAppUpdateModule) {
      return this.openPlayStoreFallback('Immediate update not available');
    }
    
    try {
      const response = await InAppUpdateModule.startImmediateUpdate();
      const result = JSON.parse(response) as InAppUpdateResult;
      
      if (result.success) {
        console.log('[InAppUpdate] Immediate update started ✓');
        console.log('[InAppUpdate] Play Store dialog should be showing...');
      } else {
        console.error('[InAppUpdate] Immediate update failed:', result.error);
        
        // If immediate fails, try to open Play Store
        return this.openPlayStoreFallback(
          result.error || 'Critical update required. Please update from Play Store.'
        );
      }
      
      return result;
    } catch (error: any) {
      console.error('[InAppUpdate] Immediate update error:', error.message || error);
      return this.openPlayStoreFallback(error.message || 'Critical update required');
    }
  }
  
  /**
   * Complete flexible update installation
   * Call this when the user restarts the app after a flexible update
   */
  async completeFlexibleUpdate(): Promise<boolean> {
    console.log('[InAppUpdate] Attempting to complete flexible update...');
    
    if (!InAppUpdateModule) {
      console.log('[InAppUpdate] Native module not available');
      return false;
    }
    
    try {
      const response = await InAppUpdateModule.completeUpdate();
      const result = JSON.parse(response) as InAppUpdateResult;
      
      if (result.success) {
        console.log('[InAppUpdate] ✅ Update installed successfully!');
        return true;
      } else {
        console.error('[InAppUpdate] Complete failed:', result.error);
        return false;
      }
    } catch (error: any) {
      console.error('[InAppUpdate] Complete error:', error.message || error);
      return false;
    }
  }
  
  /**
   * Open the app in Play Store
   * Fallback when in-app updates aren't available
   */
  private async openPlayStoreFallback(customMessage?: string): Promise<InAppUpdateResult> {
    const message = customMessage || 'Please update from Google Play Store';
    
    console.warn('[InAppUpdate] Opening Play Store...');
    console.warn('[InAppUpdate] Message:', message);
    
    Alert.alert('Update Required', message, [
      {
        text: 'Open Play Store',
        onPress: async () => {
          try {
            await Linking.openURL(
              'https://play.google.com/store/apps/details?id=com.indexpilotai.app'
            );
          } catch (e) {
            console.error('[InAppUpdate] Failed to open Play Store:', e);
          }
        },
      },
    ]);
    
    return {
      success: false,
      error: customMessage,
      shouldInstall: true,
    };
  }
  
  /**
   * Check if update is required (mandatory update scenario)
   * and start immediate update flow
   */
  async checkAndStartCriticalUpdate(): Promise<void> {
    console.log('[InAppUpdate] Checking for critical updates...');
    
    const updateInfo = await this.checkForUpdates();
    
    if (updateInfo.isUpdateAvailable) {
      console.log('[InAppUpdate] Critical update available - starting immediate update');
      
      // For critical updates, use immediate update
      await this.startImmediateUpdate();
    } else {
      console.log('[InAppUpdate] No critical updates available');
    }
  }
  
  /**
   * Start automatic update checking on app resume
   * Checks every time the app comes to the foreground
   */
  startAutoCheck(onAppResume: boolean = true): void {
    if (this.updateCheckInterval) {
      console.log('[InAppUpdate] Auto check already running');
      return;
    }
    
    console.log('[InAppUpdate] Starting auto update check');
    
    // Initial check after 5 seconds (allow app to fully load)
    setTimeout(() => {
      this.checkForUpdates();
    }, 5000);
    
    // Check every 30 minutes when app is active
    this.updateCheckInterval = setInterval(() => {
      this.checkForUpdates();
    }, 30 * 60 * 1000); // 30 minutes
    
    console.log('[InAppUpdate] Auto check scheduled (every 30 min)');
  }
  
  /**
   * Stop automatic update checking
   */
  stopAutoCheck(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
      console.log('[InAppUpdate] Auto check stopped');
    }
  }
  
  /**
   * Get current service status
   */
  getStatus(): {
    isInitialized: boolean;
    lastUpdateCheck: InAppUpdateInfo | null;
    platform: string;
  } {
    return {
      isInitialized: this.isInitialized,
      lastUpdateCheck: this.lastUpdateCheck,
      platform: Platform.OS,
    };
  }
}

// ============================================================================
// Export Singleton Instance
// ============================================================================

export const InAppUpdateService = new InAppUpdateServiceClass();

// ============================================================================
// Export Types for External Use
// ============================================================================

export type {
  InAppUpdateInfo as UpdateInfo,
  InAppUpdateResult as UpdateResult,
};

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_UPDATE_CONFIG = {
  // Time to wait before checking for updates (ms)
  initialCheckDelay: 5000,
  
  // How often to check for updates (ms)
  checkInterval: 30 * 60 * 1000, // 30 minutes
  
  // Update types
  updateType: UpdateType.FLEXIBLE,
  
  // Whether to auto-start updates
  autoStart: false,
};

export default InAppUpdateService;
