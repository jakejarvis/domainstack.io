/* @vitest-environment node */
import { afterAll, describe, expect, it, vi } from "vitest";

// Initialize PGlite before importing anything that uses the db
const { makePGliteDb, closePGliteDb } = await import("@domainstack/db/testing");
await makePGliteDb();

vi.mock("@domainstack/edge-config", () => ({
  getProviderCatalog: vi.fn<() => Promise<null>>().mockResolvedValue(null),
}));

const { getCachedRegistration } = await import("@domainstack/db/queries/registrations");
const { persistRegistration } = await import("./index");

afterAll(async () => {
  await closePGliteDb();
});

function registration(overrides: { reseller?: string } = {}) {
  return {
    domain: "reseller.test",
    tld: "test",
    isRegistered: true,
    status: "registered" as const,
    source: "rdap" as const,
    registrarProvider: { id: null, name: null, domain: null },
    ...overrides,
  };
}

describe("persistRegistration reseller", () => {
  it("survives a round trip through the cache", async () => {
    await persistRegistration("reseller.test", registration({ reseller: "Example Reseller LLC" }));

    const cached = await getCachedRegistration("reseller.test");

    expect(cached.data?.reseller).toBe("Example Reseller LLC");
  });

  it("is absent from the cached response when the record has none", async () => {
    await persistRegistration("no-reseller.test", registration());

    const cached = await getCachedRegistration("no-reseller.test");

    expect(cached.data).not.toBeNull();
    expect(cached.data?.reseller).toBeUndefined();
  });
});
