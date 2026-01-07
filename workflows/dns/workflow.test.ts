/* @vitest-environment node */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Hoist mocks for dns-utils (DoH providers)
const dnsUtilsMock = vi.hoisted(() => ({
  providerOrderForLookup: vi.fn(() => [
    { key: "cloudflare", name: "Cloudflare" },
    { key: "google", name: "Google" },
  ]),
  queryDohProvider: vi.fn(),
  DNS_TYPE_NUMBERS: {
    A: 1,
    AAAA: 28,
    MX: 15,
    TXT: 16,
    NS: 2,
  },
  DOH_PROVIDERS: {},
}));

vi.mock("@/lib/dns-utils", () => dnsUtilsMock);

// Mock cloudflare IP check
vi.mock("@/lib/cloudflare", () => ({
  isCloudflareIp: vi.fn().mockResolvedValue(false),
}));

// Mock schedule revalidation
vi.mock("@/lib/schedule", () => ({
  scheduleRevalidation: vi.fn().mockResolvedValue(undefined),
}));

describe("dnsWorkflow step functions", () => {
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    const { closePGliteDb } = await import("@/lib/db/pglite");
    await closePGliteDb();
  });

  describe("fetchFromProviders step", () => {
    it("returns DNS records from DoH provider", async () => {
      const { upsertDomain } = await import("@/lib/db/repos/domains");

      await upsertDomain({
        name: "fetch.com",
        tld: "com",
        unicodeName: "fetch.com",
      });

      // Mock DoH provider responses for each type
      dnsUtilsMock.queryDohProvider.mockImplementation(
        (_provider, _domain, type) => {
          const responses: Record<string, unknown[]> = {
            A: [{ type: 1, name: "fetch.com.", data: "1.2.3.4", TTL: 300 }],
            AAAA: [{ type: 28, name: "fetch.com.", data: "::1", TTL: 300 }],
            MX: [
              {
                type: 15,
                name: "fetch.com.",
                data: "10 mail.fetch.com.",
                TTL: 300,
              },
            ],
            TXT: [
              {
                type: 16,
                name: "fetch.com.",
                data: '"v=spf1 ~all"',
                TTL: 300,
              },
            ],
            NS: [
              { type: 2, name: "fetch.com.", data: "ns1.fetch.com.", TTL: 300 },
            ],
          };
          return Promise.resolve(responses[type] ?? []);
        },
      );

      const { dnsWorkflow } = await import("./workflow");
      const result = await dnsWorkflow({ domain: "fetch.com" });

      expect(result.success).toBe(true);
      expect(result.data.resolver).toBe("cloudflare");
      expect(result.data.records.some((r) => r.type === "A")).toBe(true);
      expect(result.data.records.some((r) => r.type === "MX")).toBe(true);
      expect(result.data.records.some((r) => r.type === "NS")).toBe(true);
    });

    it("throws RetryableError when all providers fail", async () => {
      dnsUtilsMock.queryDohProvider.mockRejectedValue(
        new Error("Network error"),
      );

      const { dnsWorkflow } = await import("./workflow");
      const { RetryableError } = await import("workflow");

      await expect(dnsWorkflow({ domain: "failing.com" })).rejects.toThrow(
        RetryableError,
      );
    });

    it("falls back to second provider on first failure", async () => {
      let callCount = 0;
      dnsUtilsMock.queryDohProvider.mockImplementation(() => {
        callCount++;
        // First 5 calls (one per type for cloudflare) fail
        if (callCount <= 5) {
          throw new Error("Cloudflare failed");
        }
        // Google succeeds
        return Promise.resolve([
          { type: 1, name: "fallback.com.", data: "9.9.9.9", TTL: 300 },
        ]);
      });

      const { dnsWorkflow } = await import("./workflow");
      const result = await dnsWorkflow({ domain: "fallback.com" });

      expect(result.success).toBe(true);
      expect(result.data.resolver).toBe("google");
    });
  });

  describe("persistRecords step", () => {
    it("persists DNS records to database", async () => {
      const { upsertDomain } = await import("@/lib/db/repos/domains");

      const domain = await upsertDomain({
        name: "persist.com",
        tld: "com",
        unicodeName: "persist.com",
      });

      // Mock DoH provider responses
      dnsUtilsMock.queryDohProvider.mockImplementation(
        (_provider, _domain, type) => {
          if (type === "A") {
            return Promise.resolve([
              { type: 1, name: "persist.com.", data: "1.2.3.4", TTL: 300 },
            ]);
          }
          return Promise.resolve([]);
        },
      );

      const { dnsWorkflow } = await import("./workflow");
      await dnsWorkflow({ domain: "persist.com" });

      // Verify records were persisted
      const { db } = await import("@/lib/db/client");
      const { dnsRecords } = await import("@/lib/db/schema");
      const { eq } = await import("drizzle-orm");

      const rows = await db
        .select()
        .from(dnsRecords)
        .where(eq(dnsRecords.domainId, domain.id));

      expect(rows.length).toBeGreaterThan(0);
      expect(rows.some((r) => r.type === "A")).toBe(true);
      expect(rows.find((r) => r.type === "A")?.value).toBe("1.2.3.4");
    });
  });

  describe("full workflow", () => {
    it("deduplicates records correctly", async () => {
      // Mock provider returning duplicate records
      dnsUtilsMock.queryDohProvider.mockImplementation(
        (_provider, _domain, type) => {
          if (type === "A") {
            return Promise.resolve([
              { type: 1, name: "dupes.com.", data: "1.2.3.4", TTL: 300 },
              { type: 1, name: "dupes.com.", data: "1.2.3.4", TTL: 300 }, // duplicate
              { type: 1, name: "dupes.com.", data: "5.6.7.8", TTL: 300 },
            ]);
          }
          return Promise.resolve([]);
        },
      );

      const { dnsWorkflow } = await import("./workflow");
      const result = await dnsWorkflow({ domain: "dupes.com" });

      const aRecords = result.data.records.filter((r) => r.type === "A");
      expect(aRecords.length).toBe(2); // Should have 2 unique records
    });

    it("sorts MX records by priority", async () => {
      dnsUtilsMock.queryDohProvider.mockImplementation(
        (_provider, _domain, type) => {
          if (type === "MX") {
            return Promise.resolve([
              {
                type: 15,
                name: "mx.com.",
                data: "30 backup.mx.com.",
                TTL: 300,
              },
              {
                type: 15,
                name: "mx.com.",
                data: "10 primary.mx.com.",
                TTL: 300,
              },
              {
                type: 15,
                name: "mx.com.",
                data: "20 secondary.mx.com.",
                TTL: 300,
              },
            ]);
          }
          return Promise.resolve([]);
        },
      );

      const { dnsWorkflow } = await import("./workflow");
      const result = await dnsWorkflow({ domain: "mx.com" });

      const mxRecords = result.data.records.filter((r) => r.type === "MX");
      expect(mxRecords.length).toBe(3);
      expect(mxRecords[0].priority).toBe(10);
      expect(mxRecords[1].priority).toBe(20);
      expect(mxRecords[2].priority).toBe(30);
    });
  });
});
