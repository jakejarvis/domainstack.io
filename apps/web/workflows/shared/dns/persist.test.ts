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

describe("persistDnsRecordsStep", () => {
  beforeEach(async () => {
    await resetPGliteDb();
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await closePGliteDb();
  });

  it("persists DNS records to database", async () => {
    const { upsertDomain } = await import("@domainstack/db/queries");
    const domain = await upsertDomain({
      name: "persist.com",
      tld: "com",
      unicodeName: "persist.com",
    });

    const { persistDnsRecordsStep } = await import("./persist");
    await persistDnsRecordsStep("persist.com", {
      resolver: "cloudflare",
      records: [{ type: "A", name: "persist.com", value: "1.2.3.4", ttl: 300 }],
      recordsWithExpiry: [
        {
          type: "A",
          name: "persist.com",
          value: "1.2.3.4",
          ttl: 300,
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
        },
      ],
    });

    // Use the PGlite db instance (already set as the singleton)
    const { dnsRecords } = await import("@domainstack/db/schema");
    const { eq } = await import("@domainstack/db/drizzle");

    const rows = await db
      .select()
      .from(dnsRecords)
      .where(eq(dnsRecords.domainId, domain.id));

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.type === "A")).toBe(true);
  });
});
