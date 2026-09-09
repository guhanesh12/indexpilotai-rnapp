#!/bin/bash
# Fix Build Script - Disable New Architecture and rebuild
# This script fixes the C++ build failure by disabling New Architecture

set -e

ANDROID_DIR="frontend/android"

echo "========================================="
echo "Fix Build Script - Disable New Architecture"
echo "========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Verify the change was applied
echo -e "\n${YELLOW}Step 1: Verifying configuration changes...${NC}"
cd "$ANDROID_DIR"
if grep -q "newArchEnabled=false" gradle.properties; then
    echo -e "  ${GREEN}✓ New Architecture is disabled${NC}"
else
    echo -e "  ${RED}✗ Failed to disable New Architecture${NC}"
    exit 1
fi
cd - > /dev/null

# Step 2: Clean Android build
echo -e "\n${YELLOW}Step 2: Cleaning Android build...${NC}"
cd "$ANDROID_DIR"
rm -rf app/build
rm -rf build
rm -rf .gradle
echo -e "  ${GREEN}✓ Build directories cleaned${NC}"
cd - > /dev/null

# Step 3: Rebuild
echo -e "\n${YELLOW}Step 3: Rebuilding Android APK...${NC}"
echo -e "  This will take 15-30 minutes..."
cd "$ANDROID_DIR"
./gradlew assembleDebug 2>&1 | tail -100
BUILD_STATUS=$?

cd - > /dev/null

# Result
echo -e "\n========================================="
if [ $BUILD_STATUS -eq 0 ]; then
    echo -e "${GREEN}Build successful!${NC}"
    echo -e "\nAPK location: $ANDROID_DIR/app/build/outputs/apk/debug/"
else
    echo -e "${RED}Build failed!${NC}"
    echo -e "\nCheck the error logs above for details."
fi

exit $BUILD_STATUS
