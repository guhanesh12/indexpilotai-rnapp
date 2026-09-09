package com.indexpilotai.app

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * InAppUpdatePackage - React Native package for InAppUpdateModule
 * 
 * This package registers the InAppUpdateModule with React Native's 
 * native module registry, making it available to JavaScript.
 * 
 * @see InAppUpdateModule
 */
class InAppUpdatePackage : ReactPackage {

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        // Return list of native modules to register
        return listOf(
            InAppUpdateModule(reactContext)
        )
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        // Return empty list - this module doesn't expose any custom views
        return emptyList()
    }
}
