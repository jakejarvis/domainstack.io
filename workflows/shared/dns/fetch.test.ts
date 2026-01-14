/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoist mocks for dns-utils (DoH providers)
// Import actual implementations for deduplication functions
const dnsUtilsMock = vi.hoisted(() => {
  // Replicate the actual deduplication logic for tests
  function makeDnsRecordKey(
    type: string,
    name: string,
    value: string,
    priority: number | null | undefined,
  ): string {
    const priorityPart = priority != null ? `|${priority}` : "";
    const normalizedName = name.trim().toLowerCase();
    const normalizedValue =
      type === "TXT" ? value.trim() : value.trim().toLowerCase();
    return `${type}|${normalizedName}|${normalizedValue}${priorityPart}`;
  }

  function deduplicateDnsRecords<
    T extends { type: string; name: string; value: string; priority?: number },
  >(records: T[]): T[] {
    const seen = new Set<string>();
    const deduplicated: T[] = [];
    for (const r of records) {
      const key = makeDnsRecordKey(r.type, r.name, r.value, r.priority);
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(r);
      }
    }
    return deduplicated;
  }

  return {
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
    makeDnsRecordKey,
    deduplicateDnsRecords,
  };
});

vi.mock("@/lib/dns-utils", () => dnsUtilsMock);

// Mock cloudflare IP check
vi.mock("@/lib/cloudflare", () => ({
  isCloudflareIp: vi.fn().mockResolvedValue(false),
}));

describe("fetchDnsRecordsStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns DNS records from DoH provider", async () => {
    dnsUtilsMock.queryDohProvider.mockImplementation(
      (_provider, _domain, type) => {
        const responses: Record<string, unknown[]> = {
          A: [{ type: 1, name: "test.com.", data: "1.2.3.4", TTL: 300 }],
          AAAA: [{ type: 28, name: "test.com.", data: "::1", TTL: 300 }],
          MX: [
            {
              type: 15,
              name: "test.com.",
              data: "10 mail.test.com.",
              TTL: 300,
            },
          ],
          TXT: [
            {
              type: 16,
              name: "test.com.",
              data: '"v=spf1 ~all"',
              TTL: 300,
            },
          ],
          NS: [{ type: 2, name: "test.com.", data: "ns1.test.com.", TTL: 300 }],
        };
        return Promise.resolve(responses[type] ?? []);
      },
    );

    const { fetchDnsRecordsStep } = await import("./fetch");
    const result = await fetchDnsRecordsStep("test.com");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.resolver).toBe("cloudflare");
      expect(result.data.records.some((r) => r.type === "A")).toBe(true);
      expect(result.data.records.some((r) => r.type === "MX")).toBe(true);
      expect(result.data.records.some((r) => r.type === "NS")).toBe(true);
    }
  });

  it("throws RetryableError when all providers fail", async () => {
    dnsUtilsMock.queryDohProvider.mockRejectedValue(new Error("Network error"));

    const { fetchDnsRecordsStep } = await import("./fetch");

    await expect(fetchDnsRecordsStep("failing.com")).rejects.toThrow(
      "All DoH providers failed",
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

    const { fetchDnsRecordsStep } = await import("./fetch");
    const result = await fetchDnsRecordsStep("fallback.com");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.resolver).toBe("google");
    }
  });

  it("deduplicates records correctly", async () => {
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

    const { fetchDnsRecordsStep } = await import("./fetch");
    const result = await fetchDnsRecordsStep("dupes.com");

    expect(result.success).toBe(true);
    if (result.success) {
      const aRecords = result.data.records.filter((r) => r.type === "A");
      expect(aRecords.length).toBe(2); // Should have 2 unique records
    }
  });

  it("sorts MX records by priority", async () => {
    dnsUtilsMock.queryDohProvider.mockImplementation(
      (_provider, _domain, type) => {
        if (type === "MX") {
          return Promise.resolve([
            { type: 15, name: "mx.com.", data: "30 backup.mx.com.", TTL: 300 },
            { type: 15, name: "mx.com.", data: "10 primary.mx.com.", TTL: 300 },
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

    const { fetchDnsRecordsStep } = await import("./fetch");
    const result = await fetchDnsRecordsStep("mx.com");

    expect(result.success).toBe(true);
    if (result.success) {
      const mxRecords = result.data.records.filter((r) => r.type === "MX");
      expect(mxRecords.length).toBe(3);
      expect(mxRecords[0].priority).toBe(10);
      expect(mxRecords[1].priority).toBe(20);
      expect(mxRecords[2].priority).toBe(30);
    }
  });
});
