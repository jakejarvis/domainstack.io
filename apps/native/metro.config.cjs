const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");
const { wrapWithReanimatedMetroConfig } = require("react-native-reanimated/metro-config");

const config = getDefaultConfig(__dirname);

module.exports = withNativewind(wrapWithReanimatedMetroConfig(config), {
  inlineVariables: false,
});
