#!/bin/bash

echo "========================================="
echo "  IndexPilotAI - Expo Server Starter"
echo "========================================="
echo ""

# --- 1. Use Node 20 LTS (required for Expo SDK 54) ---
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
echo "[1/5] Using Node: $(node -v)"

# --- 2. Kill any existing Expo/Metro processes ---
echo "[2/5] Cleaning up old Expo/Metro processes..."
lsof -ti:8081 | xargs kill -9 2>/dev/null
pkill -9 -f "expo start" 2>/dev/null
pkill -9 -f "metro" 2>/dev/null
sleep 2

# --- 3. Clear Metro bundler cache ---
echo "[3/5] Clearing Metro bundler cache..."
rm -rf .metro-cache
rm -rf node_modules/.cache
rm -rf /tmp/metro-cache
rm -rf /tmp/haste-map-*

# --- 4. Verify no process is on port 8081 ---
PORT_COUNT=$(lsof -i :8081 | wc -l | tr -d ' ')
if [ "$PORT_COUNT" -gt 0 ]; then
    echo "ERROR: Port 8081 still in use!"
    lsof -i :8081
    exit 1
fi
echo "[4/5] Port 8081 is free"

# --- 5. Start Expo dev server ---
echo "[5/5] Starting Expo dev server..."
echo ""
echo "  Waiting for QR code..."
echo "  - Scan QR with Expo Go app on your phone"
echo "  - Press 'a' for Android emulator"
echo "  - Press 'i' for iOS simulator"
echo ""
npx expo start --host lan --clear
