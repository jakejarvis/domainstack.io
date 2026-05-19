/**
 * Expo SDK 56 Babel config.
 *
 * Named `.cjs` (not `.js`) because this package is `"type": "module"`; Babel
 * loads `.cjs` config unambiguously as CommonJS.
 *
 * `babel-preset-expo` already injects the Reanimated / `react-native-worklets`
 * plugin (and it must remain last). Explicit `plugins` run before preset
 * plugins in Babel, so `@lingui/babel-plugin-lingui-macro` expands Lingui
 * macros first, then the worklets transform runs last via the preset.
 *
 * There is no React Compiler in this app, so the Lingui macro works normally
 * here (unlike the web app — see apps/web/next.config.ts).
 */
module.exports = (api) => {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: ["@lingui/babel-plugin-lingui-macro"],
  };
};
