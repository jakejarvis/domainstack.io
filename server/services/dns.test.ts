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
  answers: Array<{ name: string; TTL: number; data: string }>,
) {
  return new Response(JSON.stringify({ Status: 0, Answer: answers }), {
    status: 200,
    headers: { "content-type": "application/dns-json" },
  });
}

describe("resolveAll", () => {
  it("normalizes records and returns combined results", async () => {
    const { resolveAll } = await import("./dns");
    // The code calls DoH for A, AAAA, MX, TXT, NS in parallel and across providers; we just return A for both A and AAAA etc.
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        dohAnswer([{ name: "example.com.", TTL: 60, data: "1.2.3.4" }]),
      )
      .mockResolvedValueOnce(
        dohAnswer([{ name: "example.com.", TTL: 60, data: "1.2.3.4" }]),
      ) // AAAA
      .mockResolvedValueOnce(
        dohAnswer([
          {
            name: "example.com.",
            TTL: 300,
            data: "10 aspmx.l.google.com.",
          },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([{ name: "example.com.", TTL: 120, data: '"v=spf1"' }]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          {
            name: "example.com.",
            TTL: 600,
            data: "ns1.cloudflare.com.",
          },
        ]),
      );

    const out = await resolveAll("example.com");
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

  it("dedupes identical provider answers before persistence", async () => {
    const { resolveAll } = await import("./dns");
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "dedupe.com.", TTL: 300, data: "203.0.113.5" },
          { name: "dedupe.com.", TTL: 300, data: "203.0.113.5" },
          { name: "dedupe.com.", TTL: 300, data: "203.0.113.5" },
        ]),
      )
      .mockResolvedValueOnce(dohAnswer([]))
      .mockResolvedValueOnce(dohAnswer([]))
      .mockResolvedValueOnce(dohAnswer([]))
      .mockResolvedValueOnce(dohAnswer([]));

    const out = await resolveAll("dedupe.com");
    const aRecords = out.records.filter((r) => r.type === "A");

    expect(aRecords).toHaveLength(1);
    expect(aRecords[0]?.value).toBe("203.0.113.5");
    fetchMock.mockRestore();
  });

  it("handles duplicate MX records with different priorities (jarv.net case)", async () => {
    const { resolveAll } = await import("./dns");
    // jarv.net has MX records pointing to the same host with different priorities:
    // Priority 10: mx.netidentity.com.cust.hostedemail.com
    // Priority 20: mx.netidentity.com.cust.hostedemail.com (same host!)
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        dohAnswer([{ name: "jarv.net.", TTL: 300, data: "216.40.34.37" }]),
      )
      .mockResolvedValueOnce(
        dohAnswer([{ name: "jarv.net.", TTL: 300, data: "216.40.34.37" }]),
      ) // AAAA (returns A for simplicity)
      .mockResolvedValueOnce(
        dohAnswer([
          {
            name: "jarv.net.",
            TTL: 300,
            data: "10 mx.netidentity.com.cust.hostedemail.com.",
          },
          {
            name: "jarv.net.",
            TTL: 300,
            data: "20 mx.netidentity.com.cust.hostedemail.com.",
          },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          {
            name: "jarv.net.",
            TTL: 300,
            data: '"v=spf1 include:_spf.hostedemail.com ~all"',
          },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([{ name: "jarv.net.", TTL: 300, data: "ns1.mailbank.com." }]),
      );

    const out = await resolveAll("jarv.net");

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
    const { resolveAll } = await import("./dns");
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockRejectedValue(new Error("network"));
    await expect(resolveAll("example.invalid")).rejects.toThrow();
    fetchMock.mockRestore();
  });

  it("retries next provider when first fails and succeeds on second", async () => {
    const { resolveAll } = await import("./dns");
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
        case 1:
          return dohAnswer([
            { name: "example.com.", TTL: 60, data: "1.2.3.4" },
          ]);
        case 2:
          return dohAnswer([
            { name: "example.com.", TTL: 300, data: "10 aspmx.l.google.com." },
          ]);
        case 3:
          return dohAnswer([
            { name: "example.com.", TTL: 120, data: '"v=spf1"' },
          ]);
        default:
          return dohAnswer([
            { name: "example.com.", TTL: 600, data: "ns1.cloudflare.com." },
          ]);
      }
    });

    const out = await resolveAll("example.com");
    expect(out.records.length).toBeGreaterThan(0);
    fetchMock.mockRestore();
  });

  it("caches results across providers and preserves resolver metadata", async () => {
    const { resolveAll } = await import("./dns");

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
        dohAnswer([{ name: "example.com.", TTL: 60, data: "1.2.3.4" }]),
      )
      .mockResolvedValueOnce(
        dohAnswer([{ name: "example.com.", TTL: 60, data: "::1" }]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          {
            name: "example.com.",
            TTL: 300,
            data: "10 aspmx.l.google.com.",
          },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([{ name: "example.com.", TTL: 120, data: '"v=spf1"' }]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          {
            name: "example.com.",
            TTL: 600,
            data: "ns1.cloudflare.com.",
          },
        ]),
      );

    const first = await resolveAll("example.com");
    expect(first.records.length).toBeGreaterThan(0);
    firstFetch.mockRestore();

    // Second run: DB hit — no network calls expected
    const fetchSpy = vi.spyOn(global, "fetch");
    const second = await resolveAll("example.com");
    expect(second.records.length).toBe(first.records.length);
    expect(["cloudflare", "google", "quad9"]).toContain(second.resolver);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("handles concurrent callers via Postgres cache", async () => {
    const { resolveAll } = await import("./dns");
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
        dohAnswer([{ name: "example.com.", TTL: 60, data: "1.2.3.4" }]),
      )
      .mockResolvedValueOnce(
        dohAnswer([{ name: "example.com.", TTL: 60, data: "::1" }]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "example.com.", TTL: 300, data: "10 aspmx.l.google.com." },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([{ name: "example.com.", TTL: 120, data: '"v=spf1"' }]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "example.com.", TTL: 600, data: "ns1.cloudflare.com." },
        ]),
      );

    // First call fetches and caches
    const r1 = await resolveAll("example.com");
    expect(r1.records.length).toBeGreaterThan(0);

    // Concurrent calls should get same Postgres-cached data
    const [r2, r3] = await Promise.all([
      resolveAll("example.com"),
      resolveAll("example.com"),
    ]);

    expect(r2.records).toEqual(r1.records);
    expect(r3.records).toEqual(r1.records);
    // All callers see consistent data from Postgres cache
    fetchMock.mockRestore();
  });

  it("fetches missing AAAA during partial revalidation", async () => {
    const { resolveAll } = await import("./dns");

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
        dohAnswer([{ name: "example.com.", TTL: 60, data: "1.2.3.4" }]),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ Status: 0, Answer: [] }), {
          status: 200,
          headers: { "content-type": "application/dns-json" },
        }),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "example.com.", TTL: 300, data: "10 aspmx.l.google.com." },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([{ name: "example.com.", TTL: 120, data: '"v=spf1"' }]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "example.com.", TTL: 600, data: "ns1.cloudflare.com." },
        ]),
      );

    const first = await resolveAll("example.com");
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
            { name: "example.com.", TTL: 300, data: "2001:db8::1" },
          ]);
        }
        return dohAnswer([]);
      });

    const second = await resolveAll("example.com");
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
    const { resolveAll } = await import("./dns");

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
        dohAnswer([{ name: "domain1.com.", TTL: 60, data: "1.2.3.4" }]),
      )
      .mockResolvedValueOnce(
        dohAnswer([{ name: "domain1.com.", TTL: 60, data: "::1" }]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "domain1.com.", TTL: 300, data: "10 mx.domain1.com." },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([{ name: "domain1.com.", TTL: 120, data: '"v=spf1"' }]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "domain1.com.", TTL: 600, data: "ns1.domain1.com." },
        ]),
      );

    const result1 = await resolveAll("domain1.com");
    expect(result1.records.length).toBeGreaterThan(0);
    const resolver1 = result1.resolver;
    fetchMock1.mockRestore();

    // Second request for same domain - should use same resolver from cache
    const fetchSpy = vi.spyOn(global, "fetch");
    const result2 = await resolveAll("domain1.com");
    expect(result2.resolver).toBe(resolver1);
    expect(fetchSpy).not.toHaveBeenCalled(); // DB cache hit
    fetchSpy.mockRestore();
  });

  it("sorts A and AAAA records deterministically to prevent hydration errors", async () => {
    const { resolveAll } = await import("./dns");

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
          { name: "example.com.", TTL: 60, data: "151.101.194.133" },
          { name: "example.com.", TTL: 60, data: "151.101.130.133" },
          { name: "example.com.", TTL: 60, data: "151.101.66.133" },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "example.com.", TTL: 60, data: "2606:4700::1" },
          { name: "example.com.", TTL: 60, data: "2606:4700::2" },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "example.com.", TTL: 300, data: "10 aspmx.l.google.com." },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([{ name: "example.com.", TTL: 120, data: '"v=spf1"' }]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "example.com.", TTL: 600, data: "ns1.cloudflare.com." },
        ]),
      );

    const first = await resolveAll("example.com");
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
          { name: "example.com.", TTL: 60, data: "151.101.66.133" },
          { name: "example.com.", TTL: 60, data: "151.101.194.133" },
          { name: "example.com.", TTL: 60, data: "151.101.130.133" },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "example.com.", TTL: 60, data: "2606:4700::2" },
          { name: "example.com.", TTL: 60, data: "2606:4700::1" },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "example.com.", TTL: 300, data: "10 aspmx.l.google.com." },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([{ name: "example.com.", TTL: 120, data: '"v=spf1"' }]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "example.com.", TTL: 600, data: "ns1.cloudflare.com." },
        ]),
      );

    const second = await resolveAll("example.com");
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
    const { resolveAll } = await import("./dns");

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
        dohAnswer([{ name: "example.com.", TTL: 60, data: "1.2.3.4" }]),
      )
      .mockResolvedValueOnce(
        dohAnswer([{ name: "example.com.", TTL: 60, data: "::1" }]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "example.com.", TTL: 300, data: "10 aspmx.l.google.com." },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          {
            name: "example.com.",
            TTL: 120,
            data: '"google-site-verification=RnrF88_2OaCBS9ziVuSmclMrmr4Q78QHNASfsAOe-jM"',
          },
        ]),
      )
      .mockResolvedValueOnce(
        dohAnswer([
          { name: "example.com.", TTL: 600, data: "ns1.cloudflare.com." },
        ]),
      );

    const first = await resolveAll("example.com");
    const txtRecords = first.records.filter((r) => r.type === "TXT");

    expect(txtRecords.length).toBe(1);
    // Should preserve original case
    expect(txtRecords[0].value).toBe(
      "google-site-verification=RnrF88_2OaCBS9ziVuSmclMrmr4Q78QHNASfsAOe-jM",
    );

    firstFetch.mockRestore();

    // Second run: fetch from database cache
    const fetchSpy = vi.spyOn(global, "fetch");
    const second = await resolveAll("example.com");
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
});
