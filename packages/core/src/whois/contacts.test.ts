/* @vitest-environment node */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Initialize PGlite before importing anything that uses the db
const { makePGliteDb, closePGliteDb, resetPGliteDb } = await import("@domainstack/db/testing");
await makePGliteDb();

vi.mock("@domainstack/edge-config", () => ({
  getProviderCatalog: vi.fn<() => Promise<null>>().mockResolvedValue(null),
}));

const { getCachedRegistration } = await import("@domainstack/db/queries/registrations");
const { persistRegistration } = await import("./index");

afterAll(async () => {
  await closePGliteDb();
});

beforeEach(async () => {
  await resetPGliteDb();
});

describe("cached registration contacts", () => {
  it("round-trips contacts through persist and read", async () => {
    const contacts = [
      {
        type: "registrant" as const,
        name: "Jane Doe",
        country: "United States",
        countryCode: "US",
      },
    ];
    await persistRegistration("example.test", {
      domain: "example.test",
      tld: "test",
      isRegistered: true,
      status: "registered",
      source: "rdap",
      registrarProvider: { id: null, name: null, domain: null },
      contacts,
    });

    const { data } = await getCachedRegistration("example.test");
    expect(data?.contacts).toEqual(contacts);
  });
});
