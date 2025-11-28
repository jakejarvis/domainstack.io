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

vi.mock("@/lib/cloudflare", () => ({
  isCloudflareIp: vi.fn(async () => false),
}));

beforeAll(async () => {
  const { makePGliteDb } = await import("@/lib/db/pglite");
  const { db } = await makePGliteDb();
  vi.doMock("@/lib/db/client", () => ({ db }));
});

beforeEach(async () => {
  const { resetPGliteDb } = await import("@/lib/db/pglite");
  await resetPGliteDb();
});

afterEach(async () => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  // Close PGlite client to prevent file handle leaks
  const { closePGliteDb } = await import("@/lib/db/pglite");
  await closePGliteDb();
});

function dohAnswer(
  answers: Array<{ name: string; TTL: number; data: string; type?: number }>,
) {
  // Default to type 1 (A record) if not specified for backwards compatibility with existing tests
  const answersWithType = answers.map((a) => ({
    ...a,
    type: a.type ?? 1,
  }));
  return new Response(JSON.stringify({ Status: 0, Answer: answersWithType }), {
    status: 200,
    headers: { "content-type": "application/dns-json" },
  });
}

describe("getDnsRecords", () => {
  it("deduplicates records when DoH provider returns duplicates", async () => {
    const { getDnsRecords } = await import("./dns");
    // Simulate a DoH provider returning duplicate A records (same IP twice)
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "example.com.", TTL: 60, data: "1.2.3.4" },
          { name: "example.com.", TTL: 60, data: "1.2.3.4" }, // duplicate!
          { name: "example.com.", TTL: 60, data: "5.6.7.8" },
        ]),
      )
      .mockResolvedValueOnce(dohAnswer([])) // AAAA
      .mockResolvedValueOnce(dohAnswer([])) // MX
      .mockResolvedValueOnce(dohAnswer([])) // TXT
      .mockResolvedValueOnce(dohAnswer([])); // NS

    const out = await getDnsRecords("example.com");
    const aRecords = out.records.filter((r) => r.type === "A");

    // Should have exactly 2 A records (duplicate removed), not 3
    expect(aRecords).toHaveLength(2);
    expect(aRecords[0]?.value).toBe("1.2.3.4");
    expect(aRecords[1]?.value).toBe("5.6.7.8");

    fetchMock.mockRestore();
  });

  it("normalizes records and returns combined results", async () => {
    const { getDnsRecords } = await import("./dns");
    // The code calls DoH for A, AAAA, MX, TXT, NS in parallel and across providers; we just return A for both A and AAAA etc.
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "example.com.", TTL: 60, data: "1.2.3.4", type: 1 },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([{ name: "example.com.", TTL: 60, data: "::1", type: 28 }]),
      ) // AAAA (type 28)
      .mockResolvedValueOnce(
        dohAnswer([
          {
            name: "example.com.",
            TTL: 300,
            data: "10 aspmx.l.google.com.",
            type: 15,
          },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "example.com.", TTL: 120, data: '"v=spf1"', type: 16 },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          {
            name: "example.com.",
            TTL: 600,
            data: "ns1.cloudflare.com.",
            type: 2,
          },
        ]),
      );

    const out = await getDnsRecords("example.com");
    expect(out.records.length).toBeGreaterThan(0);
    const hasTxt = out.records.some(
      (r) => r.type === "TXT" && r.value === "v=spf1",
    );
    const hasMx = out.records.some((r) => r.type === "MX" && r.priority === 10);
    const hasNs = out.records.some(
      (r) => r.type === "NS" && r.value === "ns1.cloudflare.com",
    );
    expect(hasTxt && hasMx && hasNs).toBe(true);
    fetchMock.mockRestore();
  });

  it("handles duplicate MX records with different priorities (jarv.net case)", async () => {
    const { getDnsRecords } = await import("./dns");
    // jarv.net has MX records pointing to the same host with different priorities:
    // Priority 10: mx.netidentity.com.cust.hostedemail.com
    // Priority 20: mx.netidentity.com.cust.hostedemail.com (same host!)
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "jarv.net.", TTL: 300, data: "216.40.34.37", type: 1 },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([{ name: "jarv.net.", TTL: 300, data: "::1", type: 28 }]),
      ) // AAAA (type 28)
      .mockResolvedValueOnce(
        dohAnswer([
          {
            name: "jarv.net.",
            TTL: 300,
            data: "10 mx.netidentity.com.cust.hostedemail.com.",
            type: 15,
          },
          {
            name: "jarv.net.",
            TTL: 300,
            data: "20 mx.netidentity.com.cust.hostedemail.com.",
            type: 15,
          },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          {
            name: "jarv.net.",
            TTL: 300,
            data: '"v=spf1 include:_spf.hostedemail.com ~all"',
            type: 16,
          },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "jarv.net.", TTL: 300, data: "ns1.mailbank.com.", type: 2 },
        ]),
      );

    const out = await getDnsRecords("jarv.net");

    // Should have both MX records (same host, different priorities)
    const mxRecords = out.records.filter((r) => r.type === "MX");
    expect(mxRecords.length).toBe(2);
    expect(mxRecords.some((r) => r.priority === 10)).toBe(true);
    expect(mxRecords.some((r) => r.priority === 20)).toBe(true);
    expect(
      mxRecords.every(
        (r) => r.value === "mx.netidentity.com.cust.hostedemail.com",
      ),
    ).toBe(true);

    fetchMock.mockRestore();
  });

  it("throws when all providers fail", async () => {
    const { getDnsRecords } = await import("./dns");
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockRejectedValue(new Error("network"));
    await expect(getDnsRecords("example.invalid")).rejects.toThrow();
    fetchMock.mockRestore();
  });

  it("retries next provider when first fails and succeeds on second", async () => {
    const { getDnsRecords } = await import("./dns");
    let call = 0;
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async () => {
      call += 1;
      if (call <= 5) {
        throw new Error("provider1 fail");
      }
      // Calls 6..10 correspond to A, AAAA, MX, TXT, NS for second provider
      const idx = call - 6;
      switch (idx) {
        case 0:
          return dohAnswer([
            { name: "example.com.", TTL: 60, data: "1.2.3.4", type: 1 },
          ]);
        case 1:
          return dohAnswer([
            { name: "example.com.", TTL: 60, data: "::1", type: 28 },
          ]);
        case 2:
          return dohAnswer([
            {
              name: "example.com.",
              TTL: 300,
              data: "10 aspmx.l.google.com.",
              type: 15,
            },
          ]);
        case 3:
          return dohAnswer([
            { name: "example.com.", TTL: 120, data: '"v=spf1"', type: 16 },
          ]);
        default:
          return dohAnswer([
            {
              name: "example.com.",
              TTL: 600,
              data: "ns1.cloudflare.com.",
              type: 2,
            },
          ]);
      }
    });

    const out = await getDnsRecords("example.com");
    expect(out.records.length).toBeGreaterThan(0);
    fetchMock.mockRestore();
  });

  it("caches results across providers and preserves resolver metadata", async () => {
    const { getDnsRecords } = await import("./dns");

    // Create domain record first (simulates registered domain)
    const { upsertDomain } = await import("@/lib/db/repos/domains");
    await upsertDomain({
      name: "example.com",
      tld: "com",
      unicodeName: "example.com",
    });

    // First run: succeed and populate cache and resolver meta
    const firstFetch = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "example.com.", TTL: 60, data: "1.2.3.4", type: 1 },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([{ name: "example.com.", TTL: 60, data: "::1", type: 28 }]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          {
            name: "example.com.",
            TTL: 300,
            data: "10 aspmx.l.google.com.",
            type: 15,
          },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "example.com.", TTL: 120, data: '"v=spf1"', type: 16 },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          {
            name: "example.com.",
            TTL: 600,
            data: "ns1.cloudflare.com.",
            type: 2,
          },
        ]),
      );

    const first = await getDnsRecords("example.com");
    expect(first.records.length).toBeGreaterThan(0);
    firstFetch.mockRestore();

    // Second run: DB hit — no network calls expected
    const fetchSpy = vi.spyOn(global, "fetch");
    const second = await getDnsRecords("example.com");
    expect(second.records.length).toBe(first.records.length);
    expect(["cloudflare", "google", "quad9"]).toContain(second.resolver);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("handles concurrent callers via Postgres cache", async () => {
    const { getDnsRecords } = await import("./dns");
    const { upsertDomain } = await import("@/lib/db/repos/domains");

    // Pre-cache data in Postgres to simulate cache hit for concurrent requests
    await upsertDomain({
      name: "example.com",
      tld: "com",
      unicodeName: "example.com",
    });

    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "example.com.", TTL: 60, data: "1.2.3.4", type: 1 },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([{ name: "example.com.", TTL: 60, data: "::1", type: 28 }]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          {
            name: "example.com.",
            TTL: 300,
            data: "10 aspmx.l.google.com.",
            type: 15,
          },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "example.com.", TTL: 120, data: '"v=spf1"', type: 16 },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          {
            name: "example.com.",
            TTL: 600,
            data: "ns1.cloudflare.com.",
            type: 2,
          },
        ]),
      );

    // First call fetches and caches
    const r1 = await getDnsRecords("example.com");
    expect(r1.records.length).toBeGreaterThan(0);

    // Concurrent calls should get same Postgres-cached data
    const [r2, r3] = await Promise.all([
      getDnsRecords("example.com"),
      getDnsRecords("example.com"),
    ]);

    expect(r2.records).toEqual(r1.records);
    expect(r3.records).toEqual(r1.records);
    // All callers see consistent data from Postgres cache
    fetchMock.mockRestore();
  });

  it("fetches missing AAAA during partial revalidation", async () => {
    const { getDnsRecords } = await import("./dns");

    // Create domain record first (simulates registered domain)
    const { upsertDomain } = await import("@/lib/db/repos/domains");
    await upsertDomain({
      name: "example.com",
      tld: "com",
      unicodeName: "example.com",
    });

    // First run: full fetch; AAAA returns empty, others present
    const firstFetch = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "example.com.", TTL: 60, data: "1.2.3.4", type: 1 },
        ]),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ Status: 0, Answer: [] }), {
          status: 200,
          headers: { "content-type": "application/dns-json" },
        }),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          {
            name: "example.com.",
            TTL: 300,
            data: "10 aspmx.l.google.com.",
            type: 15,
          },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "example.com.", TTL: 120, data: '"v=spf1"', type: 16 },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          {
            name: "example.com.",
            TTL: 600,
            data: "ns1.cloudflare.com.",
            type: 2,
          },
        ]),
      );

    const first = await getDnsRecords("example.com");
    expect(first.records.some((r) => r.type === "AAAA")).toBe(false);
    firstFetch.mockRestore();

    // Second run: partial revalidation should fetch only AAAA
    const secondFetch = vi
      .spyOn(global, "fetch")
      .mockImplementation(async (input: RequestInfo | URL) => {
        const url =
          input instanceof URL
            ? input
            : new URL(
                typeof input === "string"
                  ? input
                  : ((input as unknown as { url: string }).url as string),
              );
        const type = url.searchParams.get("type");
        if (type === "AAAA") {
          return dohAnswer([
            { name: "example.com.", TTL: 300, data: "2001:db8::1", type: 28 },
          ]);
        }
        return dohAnswer([]);
      });

    const second = await getDnsRecords("example.com");
    secondFetch.mockRestore();

    // Ensure AAAA was fetched and returned
    expect(
      second.records.some(
        (r) => r.type === "AAAA" && r.value === "2001:db8::1",
      ),
    ).toBe(true);
  });
});

describe("providerOrderForLookup (hash-based selection)", () => {
  it("returns deterministic provider order for same domain", async () => {
    const { DOH_PROVIDERS, providerOrderForLookup } = await import("./dns");

    const order1 = providerOrderForLookup("example.com");
    const order2 = providerOrderForLookup("example.com");
    const order3 = providerOrderForLookup("example.com");

    expect(order1).toEqual(order2);
    expect(order2).toEqual(order3);
    expect(order1.length).toBe(DOH_PROVIDERS.length);
  });

  it("is case-insensitive for domain hashing", async () => {
    const { providerOrderForLookup } = await import("./dns");

    const order1 = providerOrderForLookup("Example.COM");
    const order2 = providerOrderForLookup("example.com");
    const order3 = providerOrderForLookup("EXAMPLE.COM");

    expect(order1).toEqual(order2);
    expect(order2).toEqual(order3);
  });

  it("distributes different domains across providers", async () => {
    const { DOH_PROVIDERS, providerOrderForLookup } = await import("./dns");

    const domains = [
      "example.com",
      "google.com",
      "github.com",
      "stackoverflow.com",
      "reddit.com",
      "twitter.com",
      "facebook.com",
      "amazon.com",
      "wikipedia.org",
      "cloudflare.com",
    ];

    const primaryProviders = domains.map(
      (domain) => providerOrderForLookup(domain)[0].key,
    );

    // Check that we get some variety (at least 2 different providers used)
    const uniqueProviders = new Set(primaryProviders);
    expect(uniqueProviders.size).toBeGreaterThanOrEqual(
      Math.min(2, DOH_PROVIDERS.length),
    );
  });

  it("maintains consistent fallback order for a domain", async () => {
    const { DOH_PROVIDERS, providerOrderForLookup } = await import("./dns");

    const order = providerOrderForLookup("test-domain.com");

    // Verify all providers are present exactly once
    expect(order.length).toBe(DOH_PROVIDERS.length);
    const providerKeys = order.map((p) => p.key);
    const uniqueKeys = new Set(providerKeys);
    expect(uniqueKeys.size).toBe(DOH_PROVIDERS.length);
  });

  it("ensures resolver consistency improves cache hits", async () => {
    const { getDnsRecords } = await import("./dns");

    // Create domain record first (simulates registered domain)
    const { upsertDomain } = await import("@/lib/db/repos/domains");
    await upsertDomain({
      name: "domain1.com",
      tld: "com",
      unicodeName: "domain1.com",
    });

    // First request for domain1
    const fetchMock1 = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "domain1.com.", TTL: 60, data: "1.2.3.4", type: 1 },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([{ name: "domain1.com.", TTL: 60, data: "::1", type: 28 }]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          {
            name: "domain1.com.",
            TTL: 300,
            data: "10 mx.domain1.com.",
            type: 15,
          },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "domain1.com.", TTL: 120, data: '"v=spf1"', type: 16 },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "domain1.com.", TTL: 600, data: "ns1.domain1.com.", type: 2 },
        ]),
      );

    const result1 = await getDnsRecords("domain1.com");
    expect(result1.records.length).toBeGreaterThan(0);
    const resolver1 = result1.resolver;
    fetchMock1.mockRestore();

    // Second request for same domain - should use same resolver from cache
    const fetchSpy = vi.spyOn(global, "fetch");
    const result2 = await getDnsRecords("domain1.com");
    expect(result2.resolver).toBe(resolver1);
    expect(fetchSpy).not.toHaveBeenCalled(); // DB cache hit
    fetchSpy.mockRestore();
  });

  it("sorts A and AAAA records deterministically to prevent hydration errors", async () => {
    const { getDnsRecords } = await import("./dns");

    // Create domain record first (simulates registered domain)
    const { upsertDomain } = await import("@/lib/db/repos/domains");
    const domain = await upsertDomain({
      name: "example.com",
      tld: "com",
      unicodeName: "example.com",
    });

    // First run: multiple A records in specific order
    const firstFetch = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "example.com.", TTL: 60, data: "151.101.194.133", type: 1 },
          { name: "example.com.", TTL: 60, data: "151.101.130.133", type: 1 },
          { name: "example.com.", TTL: 60, data: "151.101.66.133", type: 1 },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "example.com.", TTL: 60, data: "2606:4700::1", type: 28 },
          { name: "example.com.", TTL: 60, data: "2606:4700::2", type: 28 },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          {
            name: "example.com.",
            TTL: 300,
            data: "10 aspmx.l.google.com.",
            type: 15,
          },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "example.com.", TTL: 120, data: '"v=spf1"', type: 16 },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          {
            name: "example.com.",
            TTL: 600,
            data: "ns1.cloudflare.com.",
            type: 2,
          },
        ]),
      );

    const first = await getDnsRecords("example.com");
    const firstARecords = first.records.filter((r) => r.type === "A");
    const firstAAAARecords = first.records.filter((r) => r.type === "AAAA");

    expect(firstARecords.length).toBe(3);
    expect(firstAAAARecords.length).toBe(2);

    // A records should be sorted alphabetically
    expect(firstARecords[0].value).toBe("151.101.130.133");
    expect(firstARecords[1].value).toBe("151.101.194.133");
    expect(firstARecords[2].value).toBe("151.101.66.133");

    // AAAA records should be sorted alphabetically
    expect(firstAAAARecords[0].value).toBe("2606:4700::1");
    expect(firstAAAARecords[1].value).toBe("2606:4700::2");

    firstFetch.mockRestore();

    // Second run: Expire Postgres cache to force re-fetch
    const { db } = await import("@/lib/db/client");
    const { dnsRecords } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    await db
      .update(dnsRecords)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(dnsRecords.domainId, domain.id));

    // Provider returns same data but different order
    const secondFetch = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "example.com.", TTL: 60, data: "151.101.66.133", type: 1 },
          { name: "example.com.", TTL: 60, data: "151.101.194.133", type: 1 },
          { name: "example.com.", TTL: 60, data: "151.101.130.133", type: 1 },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "example.com.", TTL: 60, data: "2606:4700::2", type: 28 },
          { name: "example.com.", TTL: 60, data: "2606:4700::1", type: 28 },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          {
            name: "example.com.",
            TTL: 300,
            data: "10 aspmx.l.google.com.",
            type: 15,
          },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "example.com.", TTL: 120, data: '"v=spf1"', type: 16 },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          {
            name: "example.com.",
            TTL: 600,
            data: "ns1.cloudflare.com.",
            type: 2,
          },
        ]),
      );

    const second = await getDnsRecords("example.com");
    const secondARecords = second.records.filter((r) => r.type === "A");
    const secondAAAARecords = second.records.filter((r) => r.type === "AAAA");

    // Despite different provider order, results should be identical (deterministic)
    expect(secondARecords[0].value).toBe("151.101.130.133");
    expect(secondARecords[1].value).toBe("151.101.194.133");
    expect(secondARecords[2].value).toBe("151.101.66.133");

    expect(secondAAAARecords[0].value).toBe("2606:4700::1");
    expect(secondAAAARecords[1].value).toBe("2606:4700::2");

    secondFetch.mockRestore();
  });

  it("preserves case sensitivity in TXT records to prevent hydration errors", async () => {
    const { getDnsRecords } = await import("./dns");

    // Create domain record first (simulates registered domain)
    const { upsertDomain } = await import("@/lib/db/repos/domains");
    await upsertDomain({
      name: "example.com",
      tld: "com",
      unicodeName: "example.com",
    });

    // First run: TXT record with mixed case (like google-site-verification)
    const firstFetch = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "example.com.", TTL: 60, data: "1.2.3.4", type: 1 },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([{ name: "example.com.", TTL: 60, data: "::1", type: 28 }]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          {
            name: "example.com.",
            TTL: 300,
            data: "10 aspmx.l.google.com.",
            type: 15,
          },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          {
            name: "example.com.",
            TTL: 120,
            data: '"google-site-verification=RnrF88_2OaCBS9ziVuSmclMrmr4Q78QHNASfsAOe-jM"',
            type: 16,
          },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          {
            name: "example.com.",
            TTL: 600,
            data: "ns1.cloudflare.com.",
            type: 2,
          },
        ]),
      );

    const first = await getDnsRecords("example.com");
    const txtRecords = first.records.filter((r) => r.type === "TXT");

    expect(txtRecords.length).toBe(1);
    // Should preserve original case
    expect(txtRecords[0].value).toBe(
      "google-site-verification=RnrF88_2OaCBS9ziVuSmclMrmr4Q78QHNASfsAOe-jM",
    );

    firstFetch.mockRestore();

    // Second run: fetch from database cache
    const fetchSpy = vi.spyOn(global, "fetch");
    const second = await getDnsRecords("example.com");
    const cachedTxtRecords = second.records.filter((r) => r.type === "TXT");

    // Database should return same case (no lowercase conversion)
    expect(cachedTxtRecords.length).toBe(1);
    expect(cachedTxtRecords[0].value).toBe(
      "google-site-verification=RnrF88_2OaCBS9ziVuSmclMrmr4Q78QHNASfsAOe-jM",
    );

    // Should be a cache hit (no network calls)
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("filters out CNAME records from A/AAAA record responses (trae.ai case)", async () => {
    const { getDnsRecords } = await import("./dns");

    // Create domain record first (simulates registered domain)
    const { upsertDomain } = await import("@/lib/db/repos/domains");
    await upsertDomain({
      name: "trae.ai",
      tld: "ai",
      unicodeName: "trae.ai",
    });

    // Simulate DoH response that includes both CNAME (type 5) and A records (type 1)
    // This happens when querying a domain with a CNAME chain like:
    // trae.ai → a675.t.akamai.net → IP addresses
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockImplementation(async (input: RequestInfo | URL) => {
        const url =
          input instanceof URL
            ? input
            : new URL(
                typeof input === "string"
                  ? input
                  : ((input as unknown as { url: string }).url as string),
              );
        const type = url.searchParams.get("type");

        if (type === "A") {
          // DoH returns both CNAME records and final A records in the answer chain
          return new Response(
            JSON.stringify({
              Status: 0,
              Answer: [
                // CNAME records (type 5) should be filtered out
                {
                  name: "trae.ai.",
                  type: 5,
                  TTL: 21600,
                  data: "a675.t.akamai.net.",
                },
                {
                  name: "a675.t.akamai.net.",
                  type: 5,
                  TTL: 60,
                  data: "trae.ai.edgesuite.net.",
                },
                {
                  name: "trae.ai.edgesuite.net.",
                  type: 5,
                  TTL: 300,
                  data: "trae.ai.ttdns2.com.",
                },
                // A records (type 1) should be kept
                {
                  name: "trae.ai.ttdns2.com.",
                  type: 1,
                  TTL: 20,
                  data: "23.213.158.77",
                },
                {
                  name: "trae.ai.ttdns2.com.",
                  type: 1,
                  TTL: 20,
                  data: "23.213.158.81",
                },
              ],
            }),
            {
              status: 200,
              headers: { "content-type": "application/dns-json" },
            },
          );
        }

        if (type === "AAAA") {
          // Similar CNAME chain for AAAA records
          return new Response(
            JSON.stringify({
              Status: 0,
              Answer: [
                // CNAME records (type 5) should be filtered out
                {
                  name: "trae.ai.",
                  type: 5,
                  TTL: 21600,
                  data: "a675.t.akamai.net.",
                },
                {
                  name: "a675.t.akamai.net.",
                  type: 5,
                  TTL: 60,
                  data: "trae.ai.edgesuite.net.",
                },
                {
                  name: "trae.ai.edgesuite.net.",
                  type: 5,
                  TTL: 300,
                  data: "trae.ai.ttdns2.com.",
                },
                // No AAAA records in this case (empty final resolution)
              ],
            }),
            {
              status: 200,
              headers: { "content-type": "application/dns-json" },
            },
          );
        }

        // Other record types return empty
        return new Response(JSON.stringify({ Status: 0, Answer: [] }), {
          status: 200,
          headers: { "content-type": "application/dns-json" },
        });
      });

    const result = await getDnsRecords("trae.ai");
    const aRecords = result.records.filter((r) => r.type === "A");
    const aaaaRecords = result.records.filter((r) => r.type === "AAAA");

    // Should only have A records, not CNAME records
    expect(aRecords.length).toBe(2);
    expect(aRecords[0].value).toBe("23.213.158.77");
    expect(aRecords[1].value).toBe("23.213.158.81");

    // Should not contain any CNAME hostnames in A records
    expect(aRecords.some((r) => r.value.includes("akamai"))).toBe(false);
    expect(aRecords.some((r) => r.value.includes("edgesuite"))).toBe(false);
    expect(aRecords.some((r) => r.value.includes("ttdns2"))).toBe(false);

    // AAAA should be empty (no AAAA records in the response)
    expect(aaaaRecords.length).toBe(0);

    fetchMock.mockRestore();
  });
});
