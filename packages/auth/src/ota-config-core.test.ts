import { describe, expect, it } from "vitest";

import { buildOtaConfig } from "./ota-config-core";

describe("ota config", () => {
  it("returns enabled providers in Domainstack display order", () => {
    expect(buildOtaConfig({ enabledProviders: ["google", "github"], nativeApp: null })).toEqual({
      authProviders: [
        { id: "github", name: "GitHub" },
        { id: "google", name: "Google" },
      ],
      nativeApp: null,
    });
  });

  it("returns an empty provider list when no OAuth providers are enabled", () => {
    expect(buildOtaConfig({ enabledProviders: [], nativeApp: null })).toEqual({
      authProviders: [],
      nativeApp: null,
    });
  });

  it("folds nativeApp config into the response when provided", () => {
    const nativeApp = {
      minVersion: "1.4.0",
      storeUrlIos: "https://apps.apple.com/app/id1",
      storeUrlAndroid: "https://play.google.com/store/apps/details?id=io.domainstack.app",
    };
    expect(buildOtaConfig({ enabledProviders: [], nativeApp })).toEqual({
      authProviders: [],
      nativeApp,
    });
  });
});
