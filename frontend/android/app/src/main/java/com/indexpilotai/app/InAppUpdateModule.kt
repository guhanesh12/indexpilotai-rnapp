package com.indexpilotai.app

import android.content.Context
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.json.JSONObject

/**
 * InAppUpdateModule - Stub implementation
 * 
 * Full Play Core implementation requires Google Play Store distribution.
 * This stub provides safe fallback for debug/development builds.
 * 
 * @note For production with Play Store, use the full implementation
 *       with proper Play Core SDK dependencies
 */
class InAppUpdateModule(reactContext: ReactApplicationContext) : 
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val TAG = "InAppUpdateModule"
        const val REQUEST_CODE = 1001
        
        const val UPDATE_TYPE_FLEXIBLE = "FLEXIBLE"
        const val UPDATE_TYPE_IMMEDIATE = "IMMEDIATE"
        
        const val STATUS_UNKNOWN = "UNKNOWN"
        const val STATUS_DOWNLOADED = "DOWNLOADED"
        const val STATUS_DOWNLOADING = "DOWNLOADING"
        const val STATUS_INSTALLED = "INSTALLED"
        const val STATUS_INSTALLING = "INSTALLING"
        const val STATUS_PENDING = "PENDING"
        const val STATUS_FAILED = "FAILED"
    }

    override fun getName(): String = "InAppUpdateModule"

    /**
     * Check if app was installed from Play Store
     * Stub: Returns false - requires Play Core to check properly
     */
    @ReactMethod
    fun isPlayStoreInstall(promise: Promise) {
        try {
            val context = reactApplicationContext
            val isPlayStore = isInstalledFromPlayStore(context)
            Log.d(TAG, "isPlayStoreInstall: $isPlayStore")
            promise.resolve(isPlayStore)
        } catch (e: Exception) {
            Log.e(TAG, "isPlayStoreInstall error", e)
            promise.resolve(false)
        }
    }

    /**
     * Get app install source info
     */
    @ReactMethod
    fun getAppInstallInfo(promise: Promise) {
        try {
            val context = reactApplicationContext
            val packageInfo = getPackageInfo(context)
            val currentVersion = getCurrentVersionCode()
            
            val result = JSONObject().apply {
                put("packageName", context.packageName)
                put("versionCode", currentVersion)
                put("versionName", packageInfo?.versionName ?: "unknown")
                put("installSource", getInstallerSource(context))
                put("isPlayStore", false)
                put("installTime", packageInfo?.firstInstallTime ?: 0)
                put("updateTime", packageInfo?.lastUpdateTime ?: 0)
            }
            
            Log.d(TAG, "getAppInstallInfo: $result")
            promise.resolve(result.toString())
        } catch (e: Exception) {
            Log.e(TAG, "getAppInstallInfo error", e)
            promise.reject("ERROR", e.message)
        }
    }

    /**
     * Check for available updates
     * Stub: Returns no update available
     */
    @ReactMethod
    fun checkForUpdate(promise: Promise) {
        try {
            val currentVersion = getCurrentVersionCode()
            val result = createUpdateResult(
                isUpdateAvailable = false,
                currentVersion = currentVersion,
                availableVersion = 0,
                isStarted = false,
                installStatus = STATUS_UNKNOWN
            )
            Log.d(TAG, "checkForUpdate: $result")
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "checkForUpdate error", e)
            promise.resolve(createUpdateResult(false, 0, 0, false, "ERROR"))
        }
    }

    /**
     * Start a FLEXIBLE update
     * Stub: Returns failure - requires Play Core
     */
    @ReactMethod
    fun startFlexibleUpdate(promise: Promise) {
        try {
            Log.w(TAG, "startFlexibleUpdate: Not available without Play Core SDK")
            promise.reject("NOT_AVAILABLE", "In-app updates require Play Store distribution and Play Core SDK")
        } catch (e: Exception) {
            Log.e(TAG, "startFlexibleUpdate error", e)
            promise.reject("ERROR", e.message)
        }
    }

    /**
     * Start an IMMEDIATE update
     * Stub: Returns failure - requires Play Core
     */
    @ReactMethod
    fun startImmediateUpdate(promise: Promise) {
        try {
            Log.w(TAG, "startImmediateUpdate: Not available without Play Core SDK")
            promise.reject("NOT_AVAILABLE", "In-app updates require Play Store distribution and Play Core SDK")
        } catch (e: Exception) {
            Log.e(TAG, "startImmediateUpdate error", e)
            promise.reject("ERROR", e.message)
        }
    }

    /**
     * Complete flexible update installation
     * Stub: Returns no update to complete
     */
    @ReactMethod
    fun completeUpdate(promise: Promise) {
        try {
            Log.w(TAG, "completeUpdate: No pending update")
            promise.resolve(createResultJson(false, "No pending update to complete"))
        } catch (e: Exception) {
            Log.e(TAG, "completeUpdate error", e)
            promise.resolve(createResultJson(false, e.message))
        }
    }

    // ==========================================================================
    // Helper methods
    // ==========================================================================

    private fun isInstalledFromPlayStore(context: Context): Boolean {
        return try {
            val installer = context.packageManager.getInstallerPackageName(context.packageName)
            Log.d(TAG, "Installer package: $installer")
            
            installer != null && (
                installer == "com.android.vending" ||
                installer.contains("playstore") ||
                installer.contains("google.services")
            )
        } catch (e: Exception) {
            Log.e(TAG, "isInstalledFromPlayStore error", e)
            false
        }
    }

    private fun getInstallerSource(context: Context): String {
        return try {
            context.packageManager.getInstallerPackageName(context.packageName) ?: "unknown"
        } catch (e: Exception) {
            "unknown"
        }
    }

    private fun getPackageInfo(context: Context): PackageInfo? {
        return try {
            context.packageManager.getPackageInfo(context.packageName, 0)
        } catch (e: Exception) {
            null
        }
    }

    private fun getCurrentVersionCode(): Int {
        return try {
            val context = reactApplicationContext
            val packageInfo = context.packageManager.getPackageInfo(
                context.packageName, 
                PackageManager.GET_META_DATA
            )
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                packageInfo?.longVersionCode?.toInt() ?: 0
            } else {
                @Suppress("DEPRECATION")
                packageInfo?.versionCode ?: 0
            }
        } catch (e: Exception) {
            Log.e(TAG, "getCurrentVersionCode error", e)
            0
        }
    }

    private fun createUpdateResult(
        isUpdateAvailable: Boolean,
        currentVersion: Int,
        availableVersion: Int,
        isStarted: Boolean,
        installStatus: String
    ): String {
        return JSONObject().apply {
            put("isUpdateAvailable", isUpdateAvailable)
            put("isUpdateStarted", isStarted)
            put("updateAvailability", if (isUpdateAvailable) 1 else 2)
            put("packageVersionCode", currentVersion)
            put("availableVersionCode", availableVersion)
            put("installStatus", installStatus)
            put("updateType", if (isUpdateAvailable) UPDATE_TYPE_FLEXIBLE else "")
        }.toString()
    }

    private fun createResultJson(success: Boolean, message: String?): String {
        return JSONObject().apply {
            put("success", success)
            put("error", message)
            put("shouldInstall", !success)
            put("needsUserConfirmation", success && message?.contains("downloaded") == true)
        }.toString()
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for RN event emitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for RN event emitter
    }
}
