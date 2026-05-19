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
 *
 * The shared Lingui config lives in a SIBLING package
 * (`packages/i18n/lingui.config.ts`), not at the repo root or in this app.
 * `@lingui/babel-plugin-lingui-macro` resolves config via `@lingui/conf`'s
 * `getConfig()`, which only searches UPWARD from cwd and therefore never finds
 * a sibling-package config. Point it there explicitly via `LINGUI_CONFIG`,
 * resolved relative to THIS file so it holds in any cwd — including the EAS
 * local build's `/private/var/folders/.../build/` temp directory.
 */
const path = require("node:path");

process.env.LINGUI_CONFIG ||= path.resolve(__dirname, "../../packages/i18n/lingui.config.ts");

module.exports = (api) => {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: ["@lingui/babel-plugin-lingui-macro"],
  };
};
