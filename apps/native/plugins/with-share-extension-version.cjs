const fs = require("fs");
const path = require("path");
const { withXcodeProject, createRunOncePlugin } = require("expo/config-plugins");

// expo-share-intent generates the Share Extension Info.plist WITHOUT
// CFBundleVersion/CFBundleShortVersionString and hardcodes the extension
// target's CURRENT_PROJECT_VERSION to "1" (config.ios.buildNumber is undefined
// when eas.json uses appVersionSource: "remote"). EAS's remote autoIncrement
// then bumps only the main app, producing:
//
//   The CFBundleVersion of an app extension ('1') must match that of its
//   containing parent app ('N').
//
// EAS's version step rewrites CFBundleVersion per-target *in the Info.plist
// file*, but only sticks if the key already exists (otherwise
// GENERATE_INFOPLIST_FILE=YES regenerates it from CURRENT_PROJECT_VERSION).
// Seeding the keys here mirrors the upstream fix expo/expo#44928 shipped for
// expo-widgets. The literal values are placeholders; EAS overwrites them with
// the resolved remote build number for both targets.

const plist = require(
  require.resolve("@expo/plist", {
    paths: [path.dirname(require.resolve("expo/config-plugins"))],
  }),
).default;

const unquote = (value) => (typeof value === "string" ? value.replace(/^"(.*)"$/, "$1") : value);

const isShareExtensionBuildSettings = (buildSettings) => {
  if (!buildSettings || !buildSettings.INFOPLIST_FILE) return false;
  const bundleId = unquote(buildSettings.PRODUCT_BUNDLE_IDENTIFIER || "");
  const productName = unquote(buildSettings.PRODUCT_NAME || "");
  return bundleId.endsWith(".share-extension") || productName.includes("Extension");
};

const withShareExtensionVersion = (config) =>
  withXcodeProject(config, (xcodeConfig) => {
    const project = xcodeConfig.modResults;
    const iosRoot = xcodeConfig.modRequest.platformProjectRoot;
    const marketingVersion = xcodeConfig.version ?? "1.0.0";
    const buildNumber = String(xcodeConfig.ios?.buildNumber ?? "1");

    const configurations = project.pbxXCBuildConfigurationSection();
    const patched = new Set();

    for (const key of Object.keys(configurations)) {
      const buildSettings = configurations[key]?.buildSettings;
      if (!isShareExtensionBuildSettings(buildSettings)) continue;

      const infoPlistPath = path.join(iosRoot, unquote(buildSettings.INFOPLIST_FILE));
      if (patched.has(infoPlistPath) || !fs.existsSync(infoPlistPath)) continue;

      const info = plist.parse(fs.readFileSync(infoPlistPath, "utf8"));
      info.CFBundleShortVersionString = marketingVersion;
      info.CFBundleVersion = buildNumber;
      fs.writeFileSync(infoPlistPath, plist.build(info));
      patched.add(infoPlistPath);
      console.log(
        `[with-share-extension-version] seeded version keys in ${path.relative(iosRoot, infoPlistPath)}`,
      );
    }

    return xcodeConfig;
  });

module.exports = createRunOncePlugin(
  withShareExtensionVersion,
  "with-share-extension-version",
  "1.0.0",
);
