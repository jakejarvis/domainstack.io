/* @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

describe("getTechnologyCatalog", () => {
  it("returns null when Edge Config is not configured", async () => {
    vi.stubEnv("EDGE_CONFIG", "");

    // getTechnologyCatalog is wrapped in React's cache(), which memoizes per
    // request scope. Calling the exported function directly here (a single
    // call, in a fresh module scope) sidesteps that rather than unwrapping
    // cache() itself.
    const { getTechnologyCatalog } = await import("./edge-config");

    await expect(getTechnologyCatalog()).resolves.toBeNull();

    vi.unstubAllEnvs();
  });
});
