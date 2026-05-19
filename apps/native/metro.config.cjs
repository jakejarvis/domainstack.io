const { createRequire } = require("node:module");

const { getDefaultConfig } = require("expo/metro-config");
const { wrapWithReanimatedMetroConfig } = require("react-native-reanimated/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

const appRequire = createRequire(`${__dirname}/package.json`);

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const finalConfig = withUniwindConfig(wrapWithReanimatedMetroConfig(config), {
  cssEntryFile: "./src/global.css",
  polyfills: { rem: 14 },
});

// React MUST be a single instance in the native bundle.
const upstreamResolveRequest = finalConfig.resolver.resolveRequest;
finalConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === "react" ||
    moduleName === "react-dom" ||
    moduleName.startsWith("react/") ||
    moduleName.startsWith("react-dom/")
  ) {
    try {
      return { type: "sourceFile", filePath: appRequire.resolve(moduleName) };
    } catch {
      // Not installed at the app root — fall through to the default resolver.
    }
  }

  const resolve = upstreamResolveRequest ?? context.resolveRequest;
  return resolve(context, moduleName, platform);
};

module.exports = finalConfig;
