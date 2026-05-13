import { describe, expect, it } from "vitest";

import { buildOtaConfig } from "./ota-config-core";

describe("ota config", () => {
  it("returns enabled providers in Domainstack display order", () => {
    expect(buildOtaConfig({ enabledProviders: ["google", "github"] })).toEqual({
      authProviders: [
        { id: "github", name: "GitHub" },
        { id: "google", name: "Google" },
      ],
    });
  });

  it("returns an empty provider list when no OAuth providers are enabled", () => {
    expect(buildOtaConfig({ enabledProviders: [] })).toEqual({ authProviders: [] });
  });
});
