# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# --- Safer production shrinking for React Native / Expo / Hermes ---
# Keep RN + Expo internal reflection-heavy classes.
-keep class com.facebook.react.** { *; }
-keep class expo.modules.** { *; }

# Keep Hermes-related classes (prevents rare minifier issues)
-keep class com.facebook.hermes.** { *; }
-keepclassmembers class * {
    native <methods>;
}

# Keep Flipper (if present) from being stripped in debug-only paths
-keep class com.facebook.flipper.** { *; }

# If you hit "missing JS bundle" / TurboModule issues in release,
# you can temporarily switch off shrinking/minify via:
# -Pandroid.enableMinifyInReleaseBuilds=false
# -Pandroid.enableShrinkResourcesInReleaseBuilds=true

# --- Firebase / FCM / Notifee native modules (prevent stripping) ---
-keep class io.invertase.firebase.** { *; }
-keep class com.google.firebase.** { *; }
-keep class app.notifee.core.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.jni.** { *; }

# Keep all React Native TurboModule / NativeModule classes
-keep class * extends com.facebook.react.bridge.ReactContextBaseJavaModule { *; }
-keep class * extends com.facebook.react.turbomodule.core.interfaces.TurboModule { *; }
-keep class * implements com.facebook.react.bridge.NativeModule { *; }

# Keep Notifee event types
-keep class app.notifee.core.model.** { *; }
-keep class app.notifee.core.event.** { *; }

# Keep Firebase messaging classes
-keep class com.google.firebase.messaging.** { *; }

# Add any project specific keep options here:
