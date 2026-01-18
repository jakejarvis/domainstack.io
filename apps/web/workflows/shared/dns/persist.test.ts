/* @vitest-environment node */
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Mock schedule revalidation
vi.mock("@/lib/revalidation", () => ({
  scheduleRevalidation: vi.fn().mockResolvedValue(undefined),
}));

describe("persistDnsRecordsStep", () => {
  beforeAll(async () => {
    const { makePGliteDb } = await import("@/lib/db/pglite");
    const { db } = await makePGliteDb();
    vi.doMock("@/lib/db/client", () => ({ db }));
  });

  beforeEach(async () => {
    const { resetPGliteDb } = await import("@/lib/db/pglite");
    await resetPGliteDb();
    vi.clearAllMocks();
  });

  afterAll(async () => {
    const { closePGliteDb } = await import("@/lib/db/pglite");
    await closePGliteDb();
  });

  it("persists DNS records to database", async () => {
    const { upsertDomain } = await import("@/lib/db/repos/domains");
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

    const { db } = await import("@/lib/db/client");
    const { dnsRecords } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    const rows = await db
      .select()
      .from(dnsRecords)
      .where(eq(dnsRecords.domainId, domain.id));

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.type === "A")).toBe(true);
  });
});
