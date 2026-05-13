const fs = require("node:fs");
const path = require("node:path");

const googleSignInPlugin = require("@react-native-google-signin/google-signin/app.plugin.js");

const withGoogleSignIn = googleSignInPlugin.default ?? googleSignInPlugin;

const GOOGLE_CLIENT_ID_KEYS = [
  "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID",
  "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
  "GOOGLE_CLIENT_ID",
];

function cleanEnvValue(value) {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim().replace(/^['"]|['"]$/g, "");
  if (!trimmed || trimmed.startsWith("${")) return undefined;
  return trimmed;
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return env;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) return env;

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = cleanEnvValue(trimmed.slice(separatorIndex + 1));
      if (key && value) env[key] = value;
      return env;
    }, {});
}

function loadProjectEnv(projectRoot = path.join(__dirname, "..")) {
  return {
    ...parseEnvFile(path.join(projectRoot, ".env")),
    ...parseEnvFile(path.join(projectRoot, ".env.local")),
    ...process.env,
  };
}

function resolveGoogleClientId(env) {
  for (const key of GOOGLE_CLIENT_ID_KEYS) {
    const value = cleanEnvValue(env[key]);
    if (value) return value;
  }

  return undefined;
}

function deriveGoogleIosUrlScheme(clientId) {
  const cleanClientId = cleanEnvValue(clientId);
  if (!cleanClientId) return undefined;

  const match = cleanClientId.match(/^([^.]+)\.apps\.googleusercontent\.com$/);
  if (!match) {
    throw new Error(
      `Invalid Google OAuth client ID for iOS URL scheme derivation: ${cleanClientId}`,
    );
  }

  return `com.googleusercontent.apps.${match[1]}`;
}

function withDomainstackGoogleSignInUrlScheme(config) {
  const clientId = resolveGoogleClientId(loadProjectEnv());
  const iosUrlScheme = deriveGoogleIosUrlScheme(clientId);

  if (!iosUrlScheme) return config;

  return withGoogleSignIn(config, { iosUrlScheme });
}

module.exports = withDomainstackGoogleSignInUrlScheme;
module.exports.cleanEnvValue = cleanEnvValue;
module.exports.deriveGoogleIosUrlScheme = deriveGoogleIosUrlScheme;
module.exports.resolveGoogleClientId = resolveGoogleClientId;
