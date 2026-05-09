import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createAppRouter } from "./_app";
import type { TrackingRouterDeps } from "./tracking";

const noopTracking: TrackingRouterDeps = {
  runVerification: async () => ({
    data: { method: null, verified: false as const },
    success: false as const,
  }),
  startAutoVerify: async () => undefined,
  startInitializeSnapshot: async () => undefined,
};

describe("createAppRouter", () => {
  it("builds the app router from injected web-only dependencies", () => {
    const router = createAppRouter({
      pricingProviders: [],
      tracking: noopTracking,
    });

    expect(router).toBeDefined();
    const procedures = router._def.procedures as Record<string, unknown>;
    expect(procedures["tracking.addDomain"]).toBeDefined();
    expect(procedures["registrar.getPricing"]).toBeDefined();
  });

  it("keeps routers free of web workflow runtime imports", () => {
    const trackingRouter = readFileSync(resolve(import.meta.dirname, "tracking.ts"), "utf8");
    const appRouter = readFileSync(resolve(import.meta.dirname, "_app.ts"), "utf8");

    expect(trackingRouter).not.toContain("workflow/api");
    expect(trackingRouter).not.toContain("@/workflows");
    expect(appRouter).not.toContain("workflow/api");
    expect(appRouter).not.toContain("@/workflows");
  });
});
