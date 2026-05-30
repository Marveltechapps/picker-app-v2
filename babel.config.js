module.exports = function (api) {
  api.cache(true);
  // Force default transform for all platforms to fix web blank screen (hermes-stable
  // produces output incompatible with browser). Native Hermes can run default output.
  const presetOptions = {
    unstable_transformImportMeta: true,
    unstable_transformProfile: "default",
    web: { unstable_transformProfile: "default" },
  };
  return {
    presets: [["babel-preset-expo", presetOptions]],
    plugins: [
      "react-native-worklets-core/plugin",
      "react-native-reanimated/plugin",
    ],
  };
};