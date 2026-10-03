/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn<(key: string) => Promise<unknown>>() }));

// @vercel/global-config is a dependency of @domainstack/edge-config, not of this package,
// so a bare specifier would not resolve to the instance edge-config imports.
vi.mock("../../../edge-config/node_modules/@vercel/global-config/dist/index.js", () => ({
  get: mocks.get,
}));

import { getProviderCatalog } from "@domainstack/edge-config";

describe("getProviderCatalog", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    vi.stubEnv("GLOBAL_CONFIG", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws when the catalog key is missing", async () => {
    mocks.get.mockResolvedValue(undefined);
    await expect(getProviderCatalog()).rejects.toThrow("Provider catalog missing");
  });

  it("throws when the catalog fails validation", async () => {
    mocks.get.mockResolvedValue({
      dns: [{ name: "X", domain: "x.example", rule: { kind: "nsRegex", pattern: "(" } }],
    });
    await expect(getProviderCatalog()).rejects.toThrow("Provider catalog invalid");
  });

  it("throws when the fetch fails", async () => {
    mocks.get.mockRejectedValue(new Error("network down"));
    await expect(getProviderCatalog()).rejects.toThrow("Provider catalog unavailable");
  });

  it("returns a valid catalog", async () => {
    mocks.get.mockResolvedValue({
      dns: [{ name: "X", domain: "x.example", rule: { kind: "nsSuffix", suffix: "x.example" } }],
    });
    const catalog = await getProviderCatalog();
    expect(catalog?.dns?.[0]?.name).toBe("X");
  });

  it("returns null without reading when Global Config is not configured", async () => {
    vi.stubEnv("GLOBAL_CONFIG", "");
    vi.stubEnv("EDGE_CONFIG", "");
    await expect(getProviderCatalog()).resolves.toBeNull();
    expect(mocks.get).not.toHaveBeenCalled();
  });
});
