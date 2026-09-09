#!/bin/bash
set -euo pipefail

FRONTEND_DIR="/Users/guhanesh/Desktop/indexpilot-app 2 final/frontend"
ROOT_DIR="/Users/guhanesh/Desktop/indexpilot-app 2 final"

echo "========================================="
echo "  IndexPilotAI - Fast Expo Server Starter"
echo "========================================="
echo ""

# --- 1. Use Node 20 LTS ---
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
echo "[1/6] Using Node: $(node -v)"

# --- 2. Kill any existing Expo/Metro processes ---
echo "[2/6] Cleaning up old Expo/Metro processes..."
lsof -ti:8081 | xargs kill -9 2>/dev/null || true
lsof -ti:8083 | xargs kill -9 2>/dev/null || true
pkill -9 -f "expo start" 2>/dev/null || true
pkill -9 -f "metro" 2>/dev/null || true
sleep 2

# --- 3. Clear Metro bundler cache ---
echo "[3/6] Clearing Metro bundler cache..."
rm -rf "$FRONTEND_DIR/.expo"
rm -rf "$FRONTEND_DIR/.metro-cache"
rm -rf "$FRONTEND_DIR/node_modules/.cache"
rm -rf /tmp/metro-cache
rm -rf /tmp/haste-map-*
echo "      Done."

# --- 4. Neutralize conflicting root package.json (Expo SDK 57 vs frontend SDK 54) ---
echo "[4/6] Checking root package.json conflicts..."
if [ -f "$ROOT_DIR/package.json" ]; then
  ROOT_EXPO=$(node -e "try{console.log(require('$ROOT_DIR/package.json').dependencies?.expo || 'none')}catch(e){console.log('none')}" 2>/dev/null || echo "none")
  if [ "$ROOT_EXPO" != "none" ]; then
    echo "      Found conflicting root package.json with expo: $ROOT_EXPO"
    echo "      Moving to package.json.bak to prevent resolution conflicts..."
    mv "$ROOT_DIR/package.json" "$ROOT_DIR/package.json.bak"
    echo "      Done."
  else
    echo "      No conflicting Expo version in root."
  fi
else
  echo "      No root package.json found."
fi

# --- 5. Verify port 8081 is free ---
echo "[5/6] Checking port 8081..."
if lsof -i :8081 >/dev/null 2>&1; then
    echo "ERROR: Port 8081 still in use!"
    lsof -i :8081
    exit 1
fi
echo "      Port 8081 is free"

# --- 6. Start Expo dev server (mobile only - web disabled in app.json) ---
echo "[6/6] Starting Expo dev server (mobile only)..."
echo ""
echo "  Speed optimizations enabled:"
echo "  - Cache cleared"
echo "  - Max workers: 2 (MacBook Air optimized)"
echo "  - Web bundler disabled (app.json platforms: [ios, android])"
echo "  - Conflicting root package.json neutralized"
echo ""
echo "  Options:"
echo "  - Scan QR with Expo Go app on your phone"
echo "  - Press 'a' for Android emulator"
echo "  - Press 'i' for iOS simulator"
echo ""
cd "$FRONTEND_DIR"
npx expo start --clear --max-workers 2
