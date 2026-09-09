#!/bin/bash
# Copy logo_app_icon to Android mipmap directories as app icon

SOURCE="/Users/guhanesh/Desktop/indexpilot-app 2/frontend/assets/logo/logo_app_icon.png"
ANDROID_RES="/Users/guhanesh/Desktop/indexpilot-app 2/frontend/android/app/src/main/res"

# Copy to each mipmap directory
cp "$SOURCE" "$ANDROID_RES/mipmap-mdpi/ic_launcher.png"
cp "$SOURCE" "$ANDROID_RES/mipmap-hdpi/ic_launcher.png"
cp "$SOURCE" "$ANDROID_RES/mipmap-xhdpi/ic_launcher.png"
cp "$SOURCE" "$ANDROID_RES/mipmap-xxhdpi/ic_launcher.png"

# Also copy as round icon
cp "$SOURCE" "$ANDROID_RES/mipmap-mdpi/ic_launcher_round.png"
cp "$SOURCE" "$ANDROID_RES/mipmap-hdpi/ic_launcher_round.png"
cp "$SOURCE" "$ANDROID_RES/mipmap-xhdpi/ic_launcher_round.png"
cp "$SOURCE" "$ANDROID_RES/mipmap-xxhdpi/ic_launcher_round.png"

echo "✅ Android app icons copied successfully"
