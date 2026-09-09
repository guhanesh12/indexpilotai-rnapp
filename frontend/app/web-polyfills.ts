// Web polyfills for React Native libraries on web
// Required for react-native-reanimated v4 worklets

export default function WebPolyfills() {
  return null;
}

if (typeof window !== 'undefined') {
  // requestAnimationFrame / cancelAnimationFrame polyfill
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (callback: (timestamp: number) => void) => {
      return setTimeout(() => callback(Date.now()), 16);
    };
  }
  if (!window.cancelAnimationFrame) {
    window.cancelAnimationFrame = (id: number) => clearTimeout(id);
  }

  // performance.now polyfill
  if (!window.performance || !window.performance.now) {
    window.performance = { now: Date.now } as Performance;
  }

  // setImmediate polyfill
  if (!window.setImmediate) {
    window.setImmediate = setTimeout as any;
  }
  if (!window.clearImmediate) {
    window.clearImmediate = clearTimeout as any;
  }
}

