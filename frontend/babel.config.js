module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // For react-native-reanimated v4+, use ONLY reanimated plugin (it includes worklets internally)
    plugins: [
      'react-native-reanimated/plugin',
    ],
  };
};
