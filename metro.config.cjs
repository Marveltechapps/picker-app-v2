const { getDefaultConfig } = require("expo/metro-config");

let withRorkMetro;
try {
  withRorkMetro = require("@rork-ai/toolkit-sdk/metro").withRorkMetro;
} catch {
  withRorkMetro = null;
}

const path = require("path");
const config = getDefaultConfig(__dirname);

// Explicitly resolve expo for expo-router (fixes "Unable to resolve expo")
config.resolver = config.resolver || {};
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  expo: path.resolve(__dirname, "node_modules/expo"),
};

// Ensure web platform is properly configured
if (!config.resolver) {
  config.resolver = {};
}
// Exclude native build artifacts (.cxx, CMake) and @emnapi/runtime/dist - prevents ENOENT watcher crash
const defaultBlock = config.resolver.blockList;
const extraBlocks = [
  /[\/\\]\.cxx[\/\\].*/,
  /[\/\\]CMakeFiles[\/\\]CMakeTmp[\/\\].*/,
  /[\/\\]node_modules[\/\\]@emnapi[\/\\]runtime[\/\\]dist[\/\\].*/,
];
config.resolver.blockList = Array.isArray(defaultBlock)
  ? [...defaultBlock, ...extraBlocks]
  : defaultBlock
    ? [defaultBlock, ...extraBlocks]
    : extraBlocks;
// Do NOT add "web.ts"/"web.tsx" to sourceExts - that makes the resolver try literal .web.ts and match
// NativeImageManipulatorModule.web.ts / RNLinking.web.js on native, causing "Cannot override host object"
// and window.addEventListener errors. Metro already resolves .web.tsx when platform=web via .${platform}.tsx.
config.resolver.platforms = ["ios", "android", "native", "web"];

// On web, resolve native-only modules to empty stubs to avoid 500/MIME errors during bundle
const nativeOnlyWebStubs = [
  "react-native-maps",
  "react-native-vision-camera",
  "react-native-vision-camera-face-detector",
  "@infinitered/react-native-mlkit-face-detection",
  "@infinitered/react-native-mlkit-core",
];
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web") {
    const isStub =
      nativeOnlyWebStubs.some((m) => moduleName === m || moduleName.startsWith(m + "/"));
    if (isStub) return { type: "empty" };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Ensure transformer handles web
if (!config.transformer) {
  config.transformer = {};
}
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

// Configure assetExts to avoid Metro scanning for non-existent directories
config.resolver.assetExts = config.resolver.assetExts || [];
if (!config.resolver.assetExts.includes("json")) {
  config.resolver.assetExts = [...config.resolver.assetExts, "json"];
}

// Add blockList rule to prevent Metro from scanning src/ for assets
// (assets are in ./assets/, not ./src/assets/)
const blockListRules = config.resolver.blockList || [];
const srcAssetsBlock = /[\/\\]src[\/\\]assets[\/\\].*/;
if (!blockListRules.some((rule) => rule.source === srcAssetsBlock.source)) {
  config.resolver.blockList = [...blockListRules, srcAssetsBlock];
}

// Use @rork-ai/toolkit-sdk Metro plugin only when explicitly enabled (RORK_METRO=1).
// Omitting it avoids Expo Go bundling/loading issues; web and Expo Go work with plain config.
const useRorkMetro =
  withRorkMetro &&
  (process.env.RORK_METRO === "1" || process.env.RORK_METRO === "true");
const finalConfig = useRorkMetro ? withRorkMetro(config) : config;
module.exports = finalConfig;
