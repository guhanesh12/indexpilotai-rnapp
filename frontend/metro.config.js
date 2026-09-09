// Metro config optimized for speed on Expo SDK 54
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Use Watchman for fast file watching on macOS
config.watchman = true;

// Reduce workers on MacBook Air to avoid memory pressure / swapping
config.maxWorkers = 2;

// Speed up web builds by reducing overhead
config.serializer = {
  ...(config.serializer || {}),
  // Skip non-essential modules in dev for faster builds
  processModuleFilter: (module) => {
    const path = module.path;
    // Skip test files, build scripts, config files, and lockfiles
    if (
      path.includes('/test-') ||
      path.includes('/__tests__') ||
      path.includes('/node_modules/.bin') ||
      path.endsWith('.sh') ||
      path.includes('/cleanup-') ||
      path.includes('/fix-build') ||
      path.endsWith('.lock') ||
      path.endsWith('.log') ||
      path.includes('/.git/') ||
      path.includes('/.github/') ||
      path.match(/\/(android|ios)\/build\//)
    ) {
      return false;
    }
    return true;
  },
};

// Exclude duplicate/misplaced directories and build artifacts from Metro crawl
config.resolver.blockList = [
  // Duplicate/misplaced directories
  /\/android 2\//,
  /\/Pods 2\//,
  /\/build 2\//,
  /\/ios\/build\//,
  /\/_expo 2\//,
  /\/assets 2\//,
  /\/dist\/_expo 2\//,
  /\/dist\/assets 2\//,
  // Nested node_modules (avoid deep crawl)
  /\/node_modules\/.*\/node_modules\//,
  // Android build artifacts
  /\/android\/app\/build\//,
  /\/android\/app\/.cxx\//,
  /\/android\/app\/build\/outputs\//,
  // iOS build artifacts & Pods
  /\/ios\/build\//,
  /\/ios\/Pods\//,
  /\/ios\/Podfile 2.lock/,
  // Test/build scripts at root level that shouldn't be bundled
  /\/test-.*\.js$/,
  /\/build-release\.sh$/,
  /\/cleanup-.*\.sh$/,
  /\/fix-build\.sh$/,
  // Version control and CI
  /\/\.git\//,
  /\/\.github\//,
  // Lockfiles and config noise
  /\/\.yarn-integrity/,
  /\/yarn\.lock$/,
  /\/package-lock\.json$/,
  /\/pnpm-lock\.yaml$/,
];

module.exports = config;
