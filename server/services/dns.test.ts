/* @vitest-environment node */
import { HttpResponse, http } from "msw";
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
import { server } from "@/mocks/server";

vi.mock("@/lib/cloudflare", () => ({
  isCloudflareIp: vi.fn(async () => false),
}));

vi.mock("@/lib/db/client", async () => {
  const { makePGliteDb } = await import("@/lib/db/pglite");
  const { db } = await makePGliteDb();
  return { db };
});

beforeAll(async () => {
  // Ensure DB is initialized (though mock likely did it)
  const { makePGliteDb } = await import("@/lib/db/pglite");
  await makePGliteDb();
});

beforeEach(async () => {
  const { resetPGliteDb } = await import("@/lib/db/pglite");
  await resetPGliteDb();
});

afterEach(async () => {
  vi.restoreAllMocks();
  server.resetHandlers();
});

afterAll(async () => {
  // Close PGlite client to prevent file handle leaks
  const { closePGliteDb } = await import("@/lib/db/pglite");
  await closePGliteDb();
});

// Helper to apply a response to ALL providers to ensure consistency
// regardless of load balancing / hashing logic
// biome-ignore lint/suspicious/noExplicitAny: we need to ignore the type error here
async function mockAllProviders(responseFactory: (url: URL) => any) {
  const { DOH_PROVIDERS } = await import("@/lib/dns-utils");
  return DOH_PROVIDERS.map((provider) =>
    http.get(provider.url, ({ request }) => {
      const url = new URL(request.url);
      return HttpResponse.json(responseFactory(url));
    }),
  );
}

describe("getDnsRecords", () => {
  it("deduplicates records when DoH provider returns duplicates", async () => {
    const { getDnsRecords } = await import("./dns");

    server.use(
      ...(await mockAllProviders((url) => {
        const type = url.searchParams.get("type");
        if (type === "A") {
          return {
            Status: 0,
            Answer: [
              { name: "verified-dns.test.", TTL: 60, data: "1.2.3.4", type: 1 },
              { name: "verified-dns.test.", TTL: 60, data: "1.2.3.4", type: 1 }, // duplicate!
              { name: "verified-dns.test.", TTL: 60, data: "5.6.7.8", type: 1 },
            ],
          };
        }
        return { Status: 0, Answer: [] };
      })),
    );

    const out = await getDnsRecords("verified-dns.test");
    const aRecords = out.records.filter((r) => r.type === "A");

    // Should have exactly 2 A records (duplicate removed), not 3
    expect(aRecords).toHaveLength(2);
    expect(aRecords[0]?.value).toBe("1.2.3.4");
    expect(aRecords[1]?.value).toBe("5.6.7.8");
  });

  it("normalizes records and returns combined results", async () => {
    const { getDnsRecords } = await import("./dns");
    // Uses default handlers from mocks/handlers.ts which mimic a valid response for verified-dns.test

    const out = await getDnsRecords("verified-dns.test");
    expect(out.records.length).toBeGreaterThan(0);
    const hasTxt = out.records.some(
      (r) => r.type === "TXT" && r.value === "v=spf1",
    );
    const hasMx = out.records.some((r) => r.type === "MX" && r.priority === 10);
    const hasNs = out.records.some(
      (r) => r.type === "NS" && r.value === "ns1.verified-dns.test",
    );
    expect(hasTxt && hasMx && hasNs).toBe(true);
  });

  it("handles duplicate MX records with different priorities (multi-mx.test case)", async () => {
    const { getDnsRecords } = await import("./dns");
    // Uses default handlers which have specific data for multi-mx.test

    const out = await getDnsRecords("multi-mx.test");

    // Should have both MX records (same host, different priorities)
    const mxRecords = out.records.filter((r) => r.type === "MX");
    expect(mxRecords.length).toBe(2);
    expect(mxRecords.some((r) => r.priority === 10)).toBe(true);
    expect(mxRecords.some((r) => r.priority === 20)).toBe(true);
    expect(mxRecords.every((r) => r.value.includes(".multi-mx.test"))).toBe(
      true,
    );
  });

  it("throws when all providers fail", async () => {
    const { DOH_PROVIDERS } = await import("@/lib/dns-utils");
    const { getDnsRecords } = await import("./dns");

    // Force network error on all providers
    server.use(
      ...DOH_PROVIDERS.map((p) =>
        http.get(p.url, () => {
          return HttpResponse.error();
        }),
      ),
    );

    await expect(getDnsRecords("example.invalid")).rejects.toThrow();
  });

  it("retries next provider when first fails and succeeds on second", async () => {
    const { getDnsRecords } = await import("./dns");
    const { providerOrderForLookup } = await import("@/lib/dns-utils");

    // Identify which provider is first for this domain
    const providers = providerOrderForLookup("verified-dns.test");
    const firstProvider = providers[0];
    const secondProvider = providers[1];

    // Mock first provider to fail, others to succeed
    server.use(
      http.get(firstProvider.url, () => HttpResponse.error()),
      http.get(secondProvider.url, ({ request }) => {
        const url = new URL(request.url);
        const type = url.searchParams.get("type");
        if (type === "A") {
          return HttpResponse.json({
            Status: 0,
            Answer: [
              { name: "verified-dns.test.", TTL: 60, data: "1.2.3.4", type: 1 },
            ],
          });
        }
        return HttpResponse.json({ Status: 0, Answer: [] });
      }),
    );

    const out = await getDnsRecords("verified-dns.test");
    expect(out.records.length).toBeGreaterThan(0);
  });

  it("caches results across providers and preserves resolver metadata", async () => {
    const { getDnsRecords } = await import("./dns");

    // Create domain record first (simulates registered domain)
    const { upsertDomain } = await import("@/lib/db/repos/domains");
    await upsertDomain({
      name: "verified-dns.test",
      tld: "test",
      unicodeName: "verified-dns.test",
    });

    // First run uses default handlers (success)
    const first = await getDnsRecords("verified-dns.test");
    expect(first.records.length).toBeGreaterThan(0);

    // Track requests for second run
    const requestListener = vi.fn();
    server.events.on("request:start", requestListener);

    // Second run: DB hit — no network calls expected
    const second = await getDnsRecords("verified-dns.test");
    expect(second.records.length).toBe(first.records.length);
    expect(["cloudflare", "google", "quad9"]).toContain(second.resolver);

    // Should be no network requests
    expect(requestListener).not.toHaveBeenCalled();
    server.events.removeAllListeners();
  });

  it("handles concurrent callers via Postgres cache", async () => {
    const { getDnsRecords } = await import("./dns");
    const { upsertDomain } = await import("@/lib/db/repos/domains");

    await upsertDomain({
      name: "verified-dns.test",
      tld: "test",
      unicodeName: "verified-dns.test",
    });

    // First call fetches and caches (using default handlers)
    const r1 = await getDnsRecords("verified-dns.test");
    expect(r1.records.length).toBeGreaterThan(0);

    // Concurrent calls should get same Postgres-cached data
    const [r2, r3] = await Promise.all([
      getDnsRecords("verified-dns.test"),
      getDnsRecords("verified-dns.test"),
    ]);

    expect(r2.records).toEqual(r1.records);
    expect(r3.records).toEqual(r1.records);
  });

  it("fetches missing AAAA during partial revalidation", async () => {
    const { getDnsRecords } = await import("./dns");
    const { upsertDomain } = await import("@/lib/db/repos/domains");

    await upsertDomain({
      name: "verified-dns.test",
      tld: "test",
      unicodeName: "verified-dns.test",
    });

    // First run: AAAA returns empty for ALL providers
    // We must use a unique set of handlers for this test to avoid leakage
    server.use(
      ...(await mockAllProviders((url) => {
        const type = url.searchParams.get("type");
        if (type === "AAAA") {
          return { Status: 0, Answer: [] };
        }
        if (type === "A")
          return {
            Status: 0,
            Answer: [
              { name: "verified-dns.test.", type: 1, TTL: 60, data: "1.2.3.4" },
            ],
          };
        // Return empty for other types to keep the test clean
        return { Status: 0, Answer: [] };
      })),
    );

    const first = await getDnsRecords("verified-dns.test");
    expect(first.records.some((r) => r.type === "AAAA")).toBe(false);

    // Second run: AAAA returns data
    // Override the previous handlers with new ones that return AAAA
    // Note: resetHandlers() restores handlers to the initial list (from setupServer)
    // which has "verified-dns.test" configured with AAAA.
    server.resetHandlers();

    // Verify it finds the new record
    const second = await getDnsRecords("verified-dns.test");

    // Check if any AAAA record exists, and specifically the one from default handlers
    const hasAaaa = second.records.some((r) => r.type === "AAAA");

    expect(hasAaaa).toBe(true);
    expect(
      second.records.some(
        (r) => r.type === "AAAA" && r.value === "2001:4860:4860::8888", // Default handler value
      ),
    ).toBe(true);
  });
});

describe("providerOrderForLookup (hash-based selection)", () => {
  it("returns deterministic provider order for same domain", async () => {
    const { DOH_PROVIDERS, providerOrderForLookup } = await import(
      "@/lib/dns-utils"
    );

    const order1 = providerOrderForLookup("verified-dns.test");
    const order2 = providerOrderForLookup("verified-dns.test");
    const order3 = providerOrderForLookup("verified-dns.test");

    expect(order1).toEqual(order2);
    expect(order2).toEqual(order3);
    expect(order1.length).toBe(DOH_PROVIDERS.length);
  });

  it("is case-insensitive for domain hashing", async () => {
    const { providerOrderForLookup } = await import("@/lib/dns-utils");

    const order1 = providerOrderForLookup("Verified-DNS.TEST");
    const order2 = providerOrderForLookup("verified-dns.test");
    const order3 = providerOrderForLookup("VERIFIED-DNS.TEST");

    expect(order1).toEqual(order2);
    expect(order2).toEqual(order3);
  });

  it("distributes different domains across providers", async () => {
    const { DOH_PROVIDERS, providerOrderForLookup } = await import(
      "@/lib/dns-utils"
    );

    const domains = [
      "verified-dns.test",
      "multi-mx.test",
      "cname-chain.test",
      "no-a.test",
      "email-only.test",
      "web-hosting.test",
      "fallbacks.test",
      "provider-create.test",
      "nonhtml.test",
      "robots-content.test",
    ];

    const primaryProviders = domains.map(
      (domain) => providerOrderForLookup(domain)[0].key,
    );

    const uniqueProviders = new Set(primaryProviders);
    expect(uniqueProviders.size).toBeGreaterThanOrEqual(
      Math.min(2, DOH_PROVIDERS.length),
    );
  });

  it("maintains consistent fallback order for a domain", async () => {
    const { DOH_PROVIDERS, providerOrderForLookup } = await import(
      "@/lib/dns-utils"
    );

    const order = providerOrderForLookup("fallback-order.test");

    expect(order.length).toBe(DOH_PROVIDERS.length);
    const providerKeys = order.map((p) => p.key);
    const uniqueKeys = new Set(providerKeys);
    expect(uniqueKeys.size).toBe(DOH_PROVIDERS.length);
  });

  it("ensures resolver consistency improves cache hits", async () => {
    const { getDnsRecords } = await import("./dns");
    const { upsertDomain } = await import("@/lib/db/repos/domains");
    await upsertDomain({
      name: "cached-domain.test",
      tld: "test",
      unicodeName: "cached-domain.test",
    });

    // Mock data for cached-domain.test on ALL providers
    server.use(
      ...(await mockAllProviders((url) => {
        const type = url.searchParams.get("type");
        // Return appropriate mock data for each type to ensure caching
        if (type === "A") {
          return {
            Status: 0,
            Answer: [
              {
                name: "cached-domain.test.",
                type: 1,
                TTL: 60,
                data: "1.2.3.4",
              },
            ],
          };
        }
        if (type === "AAAA") {
          return {
            Status: 0,
            Answer: [
              { name: "cached-domain.test.", type: 28, TTL: 60, data: "::1" },
            ],
          };
        }
        if (type === "MX") {
          return {
            Status: 0,
            Answer: [
              {
                name: "cached-domain.test.",
                type: 15,
                TTL: 60,
                data: "10 mail.cached-domain.test.",
              },
            ],
          };
        }
        if (type === "TXT") {
          return {
            Status: 0,
            Answer: [
              {
                name: "cached-domain.test.",
                type: 16,
                TTL: 60,
                data: '"v=spf1 -all"',
              },
            ],
          };
        }
        if (type === "NS") {
          return {
            Status: 0,
            Answer: [
              {
                name: "cached-domain.test.",
                type: 2,
                TTL: 60,
                data: "ns1.cached-domain.test.",
              },
            ],
          };
        }
        return { Status: 0, Answer: [] };
      })),
    );

    const result1 = await getDnsRecords("cached-domain.test");
    expect(result1.records.length).toBeGreaterThan(0);
    const resolver1 = result1.resolver;

    // Second request should hit DB
    const requestListener = vi.fn();
    server.events.on("request:start", requestListener);

    const result2 = await getDnsRecords("cached-domain.test");
    expect(result2.resolver).toBe(resolver1);

    expect(requestListener).not.toHaveBeenCalled();
    server.events.removeAllListeners();
  });

  it("sorts A and AAAA records deterministically to prevent hydration errors", async () => {
    const { getDnsRecords } = await import("./dns");
    const { upsertDomain } = await import("@/lib/db/repos/domains");
    const domain = await upsertDomain({
      name: "verified-dns.test",
      tld: "test",
      unicodeName: "verified-dns.test",
    });

    // Force specific order on ALL providers
    server.use(
      ...(await mockAllProviders((url) => {
        const type = url.searchParams.get("type");
        if (type === "A") {
          return {
            Status: 0,
            Answer: [
              {
                name: "verified-dns.test.",
                TTL: 60,
                data: "151.101.194.133",
                type: 1,
              },
              {
                name: "verified-dns.test.",
                TTL: 60,
                data: "151.101.130.133",
                type: 1,
              },
              {
                name: "verified-dns.test.",
                TTL: 60,
                data: "151.101.66.133",
                type: 1,
              },
            ],
          };
        }
        if (type === "AAAA") {
          return {
            Status: 0,
            Answer: [
              {
                name: "verified-dns.test.",
                TTL: 60,
                data: "2606:4700::1",
                type: 28,
              },
              {
                name: "verified-dns.test.",
                TTL: 60,
                data: "2606:4700::2",
                type: 28,
              },
            ],
          };
        }
        return { Status: 0, Answer: [] };
      })),
    );

    const first = await getDnsRecords("verified-dns.test");
    const firstARecords = first.records.filter((r) => r.type === "A");
    const firstAAAARecords = first.records.filter((r) => r.type === "AAAA");

    expect(firstARecords.length).toBe(3);
    // Expect sorted
    expect(firstARecords[0].value).toBe("151.101.130.133");
    expect(firstARecords[1].value).toBe("151.101.194.133");
    expect(firstARecords[2].value).toBe("151.101.66.133");

    expect(firstAAAARecords[0].value).toBe("2606:4700::1");
    expect(firstAAAARecords[1].value).toBe("2606:4700::2");

    // Second run: Expire Postgres cache to force re-fetch
    const { db } = await import("@/lib/db/client");
    const { dnsRecords } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    await db
      .update(dnsRecords)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(dnsRecords.domainId, domain.id));

    // Change upstream order on ALL providers
    server.use(
      ...(await mockAllProviders((url) => {
        const type = url.searchParams.get("type");
        if (type === "A") {
          return {
            Status: 0,
            Answer: [
              {
                name: "verified-dns.test.",
                TTL: 60,
                data: "151.101.66.133",
                type: 1,
              },
              {
                name: "verified-dns.test.",
                TTL: 60,
                data: "151.101.194.133",
                type: 1,
              },
              {
                name: "verified-dns.test.",
                TTL: 60,
                data: "151.101.130.133",
                type: 1,
              },
            ],
          };
        }
        if (type === "AAAA") {
          return {
            Status: 0,
            Answer: [
              {
                name: "verified-dns.test.",
                TTL: 60,
                data: "2606:4700::2",
                type: 28,
              },
              {
                name: "verified-dns.test.",
                TTL: 60,
                data: "2606:4700::1",
                type: 28,
              },
            ],
          };
        }
        return { Status: 0, Answer: [] };
      })),
    );

    const second = await getDnsRecords("verified-dns.test");
    const secondARecords = second.records.filter((r) => r.type === "A");
    const secondAAAARecords = second.records.filter((r) => r.type === "AAAA");

    // Results should still be sorted
    expect(secondARecords[0].value).toBe("151.101.130.133");
    expect(secondARecords[1].value).toBe("151.101.194.133");
    expect(secondARecords[2].value).toBe("151.101.66.133");

    expect(secondAAAARecords[0].value).toBe("2606:4700::1");
    expect(secondAAAARecords[1].value).toBe("2606:4700::2");
  });

  it("preserves case sensitivity in TXT records", async () => {
    const { getDnsRecords } = await import("./dns");
    const { upsertDomain } = await import("@/lib/db/repos/domains");
    await upsertDomain({
      name: "verified-dns.test",
      tld: "test",
      unicodeName: "verified-dns.test",
    });

    // Uses default handlers, but need to check if default handlers have the mixed case TXT
    // The default handlers have "v=spf1". The original test used a google verification token.
    // Let's override for this test.
    server.use(
      ...(await mockAllProviders((url) => {
        const type = url.searchParams.get("type");
        if (type === "TXT") {
          return {
            Status: 0,
            Answer: [
              {
                name: "verified-dns.test.",
                TTL: 120,
                data: '"google-site-verification=RnrF88_2OaCBS9ziVuSmclMrmr4Q78QHNASfsAOe-jM"',
                type: 16,
              },
            ],
          };
        }
        if (type === "A") {
          return {
            Status: 0,
            Answer: [
              { name: "verified-dns.test.", type: 1, TTL: 60, data: "1.2.3.4" },
            ],
          };
        }
        if (type === "AAAA") {
          return {
            Status: 0,
            Answer: [
              { name: "verified-dns.test.", type: 28, TTL: 60, data: "::1" },
            ],
          };
        }
        if (type === "MX") {
          return {
            Status: 0,
            Answer: [
              {
                name: "verified-dns.test.",
                type: 15,
                TTL: 60,
                data: "10 mail.verified-dns.test.",
              },
            ],
          };
        }
        if (type === "NS") {
          return {
            Status: 0,
            Answer: [
              {
                name: "verified-dns.test.",
                type: 2,
                TTL: 60,
                data: "ns1.verified-dns.test.",
              },
            ],
          };
        }
        return { Status: 0, Answer: [] };
      })),
    );

    const first = await getDnsRecords("verified-dns.test");
    const txtRecords = first.records.filter((r) => r.type === "TXT");

    expect(txtRecords.length).toBe(1);
    expect(txtRecords[0].value).toBe(
      "google-site-verification=RnrF88_2OaCBS9ziVuSmclMrmr4Q78QHNASfsAOe-jM",
    );

    // Second run: fetch from database cache
    const requestListener = vi.fn();
    server.events.on("request:start", requestListener);

    const second = await getDnsRecords("verified-dns.test");
    const cachedTxtRecords = second.records.filter((r) => r.type === "TXT");

    expect(cachedTxtRecords.length).toBe(1);
    expect(cachedTxtRecords[0].value).toBe(
      "google-site-verification=RnrF88_2OaCBS9ziVuSmclMrmr4Q78QHNASfsAOe-jM",
    );

    expect(requestListener).not.toHaveBeenCalled();
    server.events.removeAllListeners();
  });

  it("filters out CNAME records from A/AAAA record responses (cname-chain.test case)", async () => {
    const { getDnsRecords } = await import("./dns");
    const { upsertDomain } = await import("@/lib/db/repos/domains");
    await upsertDomain({
      name: "cname-chain.test",
      tld: "test",
      unicodeName: "cname-chain.test",
    });

    // Uses default handlers which have specific data for cname-chain.test
    const result = await getDnsRecords("cname-chain.test");
    const aRecords = result.records.filter((r) => r.type === "A");
    const aaaaRecords = result.records.filter((r) => r.type === "AAAA");

    expect(aRecords.length).toBe(2);
    expect(aRecords[0].value).toBe("23.213.158.77");
    expect(aRecords[1].value).toBe("23.213.158.81");

    expect(aRecords.some((r) => r.value.includes("alias"))).toBe(false);
    expect(aRecords.some((r) => r.value.includes("target"))).toBe(false);

    expect(aaaaRecords.length).toBe(0);
  });
});
