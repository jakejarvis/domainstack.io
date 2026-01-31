/* @vitest-environment node */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Initialize PGlite before importing anything that uses the db
const { makePGliteDb, closePGliteDb, resetPGliteDb } = await import(
  "@domainstack/db/testing"
);
const { db } = await makePGliteDb();

// Mock schedule revalidation
vi.mock("@/lib/revalidation", () => ({
  scheduleRevalidation: vi.fn().mockResolvedValue(undefined),
}));

describe("persistRegistrationStep", () => {
  beforeEach(async () => {
    await resetPGliteDb();
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await closePGliteDb();
  });

  it("persists registered domain to database", async () => {
    // rawResponse is the raw RDAP JSON object (not prettified)
    const rawRdapResponse = {
      objectClassName: "domain",
      handle: "persist.com",
      ldhName: "persist.com",
    };

    const response = {
      domain: "persist.com",
      tld: "com",
      isRegistered: true,
      status: "registered" as const,
      source: "rdap" as const,
      registrarProvider: { id: null, name: "GoDaddy", domain: null },
      rawResponse: rawRdapResponse,
    };

    const { persistRegistrationStep } = await import("./persist");
    const domainId = await persistRegistrationStep("persist.com", response);

    expect(domainId).toBeTruthy();

    // Use the PGlite db instance (already set as the singleton)
    const { domains, registrations } = await import("@domainstack/db/schema");
    const { eq } = await import("@domainstack/db/drizzle");

    const domainRows = await db
      .select()
      .from(domains)
      .where(eq(domains.name, "persist.com"));

    expect(domainRows).toHaveLength(1);

    const regRows = await db
      .select()
      .from(registrations)
      .where(eq(registrations.domainId, domainRows[0].id));

    expect(regRows).toHaveLength(1);
    expect(regRows[0].isRegistered).toBe(true);
  });
});
