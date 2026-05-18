const path = require("node:path");

const { getDefaultConfig } = require("expo/metro-config");
const { wrapWithReanimatedMetroConfig } = require("react-native-reanimated/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const finalConfig = withUniwindConfig(wrapWithReanimatedMetroConfig(config), {
  cssEntryFile: "./src/global.css",
  polyfills: { rem: 14 },
});

// Force a single React instance in the native bundle
const reactRoot = path.dirname(require.resolve("react/package.json"));
const reactDomRoot = path.dirname(require.resolve("react-dom/package.json"));

const pinReactModule = (moduleName) => {
  if (moduleName === "react" || moduleName.startsWith("react/")) {
    return path.join(reactRoot, moduleName.slice("react".length));
  }
  if (moduleName === "react-dom" || moduleName.startsWith("react-dom/")) {
    return path.join(reactDomRoot, moduleName.slice("react-dom".length));
  }
  return null;
};

const upstreamResolveRequest = finalConfig.resolver.resolveRequest;

finalConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = upstreamResolveRequest ?? context.resolveRequest;
  return resolve(context, pinReactModule(moduleName) ?? moduleName, platform);
};

module.exports = finalConfig;
