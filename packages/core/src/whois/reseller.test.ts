/* @vitest-environment node */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Initialize PGlite before importing anything that uses the db
const { makePGliteDb, closePGliteDb, resetPGliteDb } = await import("@domainstack/db/testing");
const { db } = await makePGliteDb();

vi.mock("@domainstack/edge-config", () => ({
  getProviderCatalog: vi.fn<() => Promise<null>>().mockResolvedValue(null),
}));

const { providers } = await import("@domainstack/db/schema");
const { getCachedRegistration } = await import("@domainstack/db/queries/registrations");
const { persistRegistration } = await import("./index");

afterAll(async () => {
  await closePGliteDb();
});

beforeEach(async () => {
  await resetPGliteDb();
});

function registration(overrides: { reseller?: string } = {}) {
  return {
    domain: "example.test",
    tld: "test",
    isRegistered: true,
    status: "registered" as const,
    source: "rdap" as const,
    registrarProvider: { id: null, name: null, domain: null },
    ...overrides,
  };
}

describe("persistRegistration reseller", () => {
  it("links a reseller that is already a known registrar, and returns it from the cache", async () => {
    await db.insert(providers).values({
      category: "registrar",
      name: "Example Reseller LLC",
      slug: "example-reseller-llc",
    });

    await persistRegistration("example.test", registration({ reseller: "example reseller llc" }));

    const cached = await getCachedRegistration("example.test");
    expect(cached.data?.reseller).toBe("Example Reseller LLC");
  });

  it("does not invent registrar providers from an unknown reseller name", async () => {
    await persistRegistration("example.test", registration({ reseller: "Unknown Reseller Inc" }));

    expect(await db.select().from(providers)).toHaveLength(0);
    const cached = await getCachedRegistration("example.test");
    expect(cached.data).not.toBeNull();
    expect(cached.data?.reseller).toBeUndefined();
  });

  it("has no reseller when the record has none", async () => {
    await persistRegistration("example.test", registration());

    const cached = await getCachedRegistration("example.test");
    expect(cached.data?.reseller).toBeUndefined();
  });
});
