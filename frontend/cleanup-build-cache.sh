#!/bin/bash

echo "🧹 Cleaning Expo/React Native build caches..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get initial size
INITIAL_SIZE=$(du -sh . | cut -f1)
echo "📊 Initial project size: $INITIAL_SIZE"
echo ""

# Clean Android build artifacts
echo "🤖 Cleaning Android build artifacts..."
if [ -d "android/app/build" ]; then
    rm -rf android/app/build
    echo -e "${GREEN}✓${NC} Removed android/app/build (saves ~400MB)"
fi

# Clean Android C++ cache
if [ -d "android/app/.cxx" ]; then
    rm -rf android/app/.cxx
    echo -e "${GREEN}✓${NC} Removed android/app/.cxx (saves ~12MB)"
fi

# Clean iOS build artifacts
if [ -d "ios/build" ]; then
    rm -rf ios/build
    echo -e "${GREEN}✓${NC} Removed ios/build"
fi

if [ -d "ios/build 2" ]; then
    rm -rf ios/build 2
    echo -e "${GREEN}✓${NC} Removed ios/build 2"
fi

# Clean iOS Pods (can be regenerated with pod install)
echo ""
echo "🍎 Cleaning iOS Pods (can be regenerated with 'cd ios && pod install')..."
if [ -d "ios/Pods" ]; then
    rm -rf ios/Pods
    echo -e "${GREEN}✓${NC} Removed ios/Pods (saves ~700MB)"
fi

if [ -d "ios/Pods 2" ]; then
    rm -rf ios/Pods 2
    echo -e "${GREEN}✓${NC} Removed ios/Pods 2"
fi

# Clean Podfile.lock files (will be regenerated)
if [ -f "ios/Podfile.lock" ]; then
    rm -f ios/Podfile.lock
    echo -e "${GREEN}✓${NC} Removed ios/Podfile.lock"
fi

if [ -f "ios/Podfile 2.lock" ]; then
    rm -f "ios/Podfile 2.lock"
    echo -e "${GREEN}✓${NC} Removed ios/Podfile 2.lock"
fi

# Clean Metro bundler cache
echo ""
echo "📦 Cleaning Metro bundler cache..."
if [ -d "$TMPDIR/metro-*" ]; then
    rm -rf "$TMPDIR/metro-*"
    echo -e "${GREEN}✓${NC} Removed Metro cache"
fi

# Clean Expo cache
if [ -d ".expo" ]; then
    rm -rf .expo
    echo -e "${GREEN}✓${NC} Removed .expo cache"
fi

# Clean node_modules/.cache if exists
if [ -d "node_modules/.cache" ]; then
    rm -rf node_modules/.cache
    echo -e "${GREEN}✓${NC} Removed node_modules cache"
fi

# Get final size
FINAL_SIZE=$(du -sh . | cut -f1)
echo ""
echo "📊 Final project size: $FINAL_SIZE"
echo ""

# Calculate savings
echo "💾 Space saved!"
echo ""
echo -e "${YELLOW}⚠️  Note:${NC}"
echo "  - To rebuild Android: Run 'yarn android' or 'cd android && ./gradlew assembleDebug'"
echo "  - To rebuild iOS: Run 'cd ios && pod install' then 'yarn ios'"
echo "  - Node modules are preserved (needed for development)"
echo ""
echo "🚀 To start Expo again: yarn start"