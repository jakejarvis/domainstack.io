import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const appConfig = require("../app.json");
const {
  cleanEnvValue,
  deriveGoogleIosUrlScheme,
  resolveGoogleClientId,
} = require("./with-google-sign-in-url-scheme.cjs");

describe("Google Sign-In Expo config plugin", () => {
  it("derives the iOS URL scheme from a Google OAuth client ID", () => {
    expect(deriveGoogleIosUrlScheme("1058067839282-cr4lkpd4s2.apps.googleusercontent.com")).toBe(
      "com.googleusercontent.apps.1058067839282-cr4lkpd4s2",
    );
  });

  it("prefers the iOS client ID while allowing an Android-safe web client fallback", () => {
    expect(
      resolveGoogleClientId({
        EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: "ios-client.apps.googleusercontent.com",
        EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: "web-client.apps.googleusercontent.com",
      }),
    ).toBe("ios-client.apps.googleusercontent.com");

    expect(
      resolveGoogleClientId({
        EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: "",
        EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: "web-client.apps.googleusercontent.com",
      }),
    ).toBe("web-client.apps.googleusercontent.com");
  });

  it("ignores empty, quoted, and placeholder values", () => {
    expect(cleanEnvValue(" '${EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID}' ")).toBeUndefined();
    expect(cleanEnvValue(' "client.apps.googleusercontent.com" ')).toBe(
      "client.apps.googleusercontent.com",
    );
  });

  it("keeps app.json on the local derivation plugin instead of a placeholder scheme", () => {
    expect(appConfig.expo.plugins).toContain("./plugins/with-google-sign-in-url-scheme.cjs");
    expect(JSON.stringify(appConfig)).not.toContain("com.googleusercontent.apps.domainstack");
  });
});
