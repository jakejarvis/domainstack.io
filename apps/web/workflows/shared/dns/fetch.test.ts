/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoist mocks for dns-utils (DoH providers)
// Import actual implementations for deduplication and sorting functions
const dnsUtilsMock = vi.hoisted(() => {
  type DnsRecordType = "A" | "AAAA" | "MX" | "TXT" | "NS";
  interface DnsRecord {
    type: DnsRecordType;
    name: string;
    value: string;
    ttl?: number;
    priority?: number;
    isCloudflare?: boolean;
  }

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

  // Replicate the actual sorting logic for tests
  function sortDnsRecordsForType(
    records: DnsRecord[],
    type: DnsRecordType,
  ): DnsRecord[] {
    const sorted = [...records];
    if (type === "MX") {
      sorted.sort((a, b) => {
        const ap = a.priority ?? Number.MAX_SAFE_INTEGER;
        const bp = b.priority ?? Number.MAX_SAFE_INTEGER;
        if (ap !== bp) return ap - bp;
        return a.value.localeCompare(b.value);
      });
      return sorted;
    }
    sorted.sort((a, b) => a.value.localeCompare(b.value));
    return sorted;
  }

  function sortDnsRecordsByType(
    records: DnsRecord[],
    order: readonly DnsRecordType[],
  ): DnsRecord[] {
    const byType: Record<DnsRecordType, DnsRecord[]> = {
      A: [],
      AAAA: [],
      MX: [],
      TXT: [],
      NS: [],
    };
    for (const r of records) byType[r.type].push(r);

    const sorted: DnsRecord[] = [];
    for (const t of order) {
      sorted.push(...sortDnsRecordsForType(byType[t], t));
    }
    return sorted;
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
    sortDnsRecordsByType,
  };
});

vi.mock("@domainstack/utils/dns", () => dnsUtilsMock);

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
          A: [{ type: 1, name: "test.invalid.", data: "1.2.3.4", TTL: 300 }],
          AAAA: [{ type: 28, name: "test.invalid.", data: "::1", TTL: 300 }],
          MX: [
            {
              type: 15,
              name: "test.invalid.",
              data: "10 mail.test.invalid.",
              TTL: 300,
            },
          ],
          TXT: [
            {
              type: 16,
              name: "test.invalid.",
              data: '"v=spf1 ~all"',
              TTL: 300,
            },
          ],
          NS: [
            {
              type: 2,
              name: "test.invalid.",
              data: "ns1.test.invalid.",
              TTL: 300,
            },
          ],
        };
        return Promise.resolve(responses[type] ?? []);
      },
    );

    const { fetchDnsRecordsStep } = await import("./fetch");
    const result = await fetchDnsRecordsStep("test.invalid");

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

    await expect(fetchDnsRecordsStep("failing.invalid")).rejects.toThrow(
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
        { type: 1, name: "fallback.invalid.", data: "9.9.9.9", TTL: 300 },
      ]);
    });

    const { fetchDnsRecordsStep } = await import("./fetch");
    const result = await fetchDnsRecordsStep("fallback.invalid");

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
            { type: 1, name: "dupes.invalid.", data: "1.2.3.4", TTL: 300 },
            { type: 1, name: "dupes.invalid.", data: "1.2.3.4", TTL: 300 }, // duplicate
            { type: 1, name: "dupes.invalid.", data: "5.6.7.8", TTL: 300 },
          ]);
        }
        return Promise.resolve([]);
      },
    );

    const { fetchDnsRecordsStep } = await import("./fetch");
    const result = await fetchDnsRecordsStep("dupes.invalid");

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
            {
              type: 15,
              name: "mx.invalid.",
              data: "30 backup.mx.invalid.",
              TTL: 300,
            },
            {
              type: 15,
              name: "mx.invalid.",
              data: "10 primary.mx.invalid.",
              TTL: 300,
            },
            {
              type: 15,
              name: "mx.invalid.",
              data: "20 secondary.mx.invalid.",
              TTL: 300,
            },
          ]);
        }
        return Promise.resolve([]);
      },
    );

    const { fetchDnsRecordsStep } = await import("./fetch");
    const result = await fetchDnsRecordsStep("mx.invalid");

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
