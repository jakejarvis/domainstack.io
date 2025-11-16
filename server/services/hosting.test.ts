/* @vitest-environment node */
import type { Mock } from "vitest";
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

// Import lazily inside tests after DB injection to avoid importing the client early

// Mocks for dependencies used by detectHosting
vi.mock("@/server/services/dns", () => ({
  resolveAll: vi.fn(async () => ({ records: [], source: "mock" })),
}));
vi.mock("@/server/services/headers", () => ({
  probeHeaders: vi.fn(async () => []),
}));
vi.mock("@/server/services/ip", () => ({
  lookupIpMeta: vi.fn(async () => ({
    geo: {
      city: "",
      region: "",
      country: "",
      country_code: "",
      lat: null,
      lon: null,
    },
    owner: null,
    domain: null,
  })),
}));

// Ensure toRegistrableDomain accepts our test domains (including .example)
vi.mock("@/lib/domain-server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/domain-server")>();
  return {
    ...actual,
    toRegistrableDomain: (input: string) => {
      const v = (input ?? "").trim().toLowerCase().replace(/\.$/, "");
      if (!v) return null;
      const parts = v.split(".").filter(Boolean);
      if (parts.length >= 2)
        return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
      return v;
    },
  };
});

beforeAll(async () => {
  const { makePGliteDb } = await import("@/lib/db/pglite");
  const { db } = await makePGliteDb();
  vi.doMock("@/lib/db/client", () => ({ db }));
  const { makeInMemoryRedis } = await import("@/lib/redis-mock");
  const impl = makeInMemoryRedis();
  vi.doMock("@/lib/redis", () => impl);
});

beforeEach(async () => {
  const { resetPGliteDb } = await import("@/lib/db/pglite");
  await resetPGliteDb();
});

afterEach(async () => {
  vi.restoreAllMocks();
  const { resetInMemoryRedis } = await import("@/lib/redis-mock");
  resetInMemoryRedis();
});

afterAll(async () => {
  // Close PGlite client to prevent file handle leaks
  const { closePGliteDb } = await import("@/lib/db/pglite");
  await closePGliteDb();
});

describe("detectHosting", () => {
  it("returns known providers when signals match (Vercel/Google/Cloudflare)", async () => {
    // Arrange
    const { resolveAll } = await import("@/server/services/dns");
    const { probeHeaders } = await import("@/server/services/headers");
    const { lookupIpMeta } = await import("@/server/services/ip");
    const { detectHosting } = await import("@/server/services/hosting");

    (resolveAll as unknown as Mock).mockResolvedValue({
      records: [
        { type: "A", name: "example.com", value: "1.2.3.4", ttl: 60 },
        {
          type: "MX",
          name: "example.com",
          value: "aspmx.l.google.com",
          ttl: 300,
          priority: 10,
        },
        {
          type: "NS",
          name: "example.com",
          value: "ns1.cloudflare.com",
          ttl: 600,
        },
      ],
      source: "mock",
    });
    (probeHeaders as unknown as Mock).mockResolvedValue({
      headers: [
        { name: "server", value: "Vercel" },
        { name: "x-vercel-id", value: "abc" },
      ],
      status: 200,
      statusMessage: "OK",
    });
    (lookupIpMeta as unknown as Mock).mockResolvedValue({
      geo: {
        city: "San Francisco",
        region: "CA",
        country: "US",
        lat: 1,
        lon: 2,
      },
      owner: null,
      domain: null,
    });

    // Act
    const result = await detectHosting("example.com");

    // Assert
    expect(result.hostingProvider.name).toBe("Vercel");
    expect(result.hostingProvider.domain).toBe("vercel.com");
    expect(result.emailProvider.name).toBe("Google Workspace");
    expect(result.emailProvider.domain).toBe("google.com");
    expect(result.dnsProvider.name).toBe("Cloudflare");
    expect(result.dnsProvider.domain).toBe("cloudflare.com");
    expect(result.geo.country).toBe("US");
  });

  it("sets hosting to none when no A record is present", async () => {
    const { resolveAll } = await import("@/server/services/dns");
    const { detectHosting } = await import("@/server/services/hosting");
    (resolveAll as unknown as Mock).mockResolvedValue({
      records: [
        {
          type: "MX",
          name: "example.com",
          value: "aspmx.l.google.com",
          ttl: 300,
          priority: 10,
        },
        {
          type: "NS",
          name: "example.com",
          value: "ns1.cloudflare.com",
          ttl: 600,
        },
      ],
      source: "mock",
    });

    const result = await detectHosting("no-a.example");
    expect(result.hostingProvider.name).toBeNull();
    expect(result.hostingProvider.domain).toBeNull();
  });

  it("skips headers probe when domain has no A or AAAA records", async () => {
    const { resolveAll } = await import("@/server/services/dns");
    const { probeHeaders } = await import("@/server/services/headers");
    const { detectHosting } = await import("@/server/services/hosting");

    // Clear any previous calls
    (probeHeaders as unknown as Mock).mockClear();

    // Mock DNS with no A/AAAA records (email-only domain)
    (resolveAll as unknown as Mock).mockResolvedValue({
      records: [
        {
          type: "MX",
          name: "email-only.example",
          value: "aspmx.l.google.com",
          ttl: 300,
          priority: 10,
        },
        {
          type: "NS",
          name: "email-only.example",
          value: "ns1.cloudflare.com",
          ttl: 600,
        },
      ],
      source: "mock",
    });

    await detectHosting("email-only.example");

    // probeHeaders should NOT have been called
    expect(probeHeaders).not.toHaveBeenCalled();
  });

  it("calls headers probe when domain has A or AAAA records", async () => {
    const { resolveAll } = await import("@/server/services/dns");
    const { probeHeaders } = await import("@/server/services/headers");
    const { detectHosting } = await import("@/server/services/hosting");

    // Clear any previous calls
    (probeHeaders as unknown as Mock).mockClear();

    // Mock DNS with A record (web hosting present)
    (resolveAll as unknown as Mock).mockResolvedValue({
      records: [
        { type: "A", name: "web-hosting.example", value: "1.2.3.4", ttl: 60 },
        {
          type: "NS",
          name: "web-hosting.example",
          value: "ns1.cloudflare.com",
          ttl: 600,
        },
      ],
      source: "mock",
    });
    (probeHeaders as unknown as Mock).mockResolvedValue({
      headers: [],
      status: 200,
      statusMessage: "OK",
    });

    await detectHosting("web-hosting.example");

    // probeHeaders SHOULD have been called since A record exists
    expect(probeHeaders).toHaveBeenCalledWith("web-hosting.example");
  });

  it("falls back to IP owner when hosting is unknown and IP owner exists", async () => {
    const { resolveAll } = await import("@/server/services/dns");
    const { probeHeaders } = await import("@/server/services/headers");
    const { lookupIpMeta } = await import("@/server/services/ip");
    const { detectHosting } = await import("@/server/services/hosting");

    (resolveAll as unknown as Mock).mockResolvedValue({
      records: [{ type: "A", name: "x", value: "9.9.9.9", ttl: 60 }],
      source: "mock",
    });
    (probeHeaders as unknown as Mock).mockResolvedValue({
      headers: [],
      status: 200,
      statusMessage: "OK",
    });
    (lookupIpMeta as unknown as Mock).mockResolvedValue({
      geo: {
        city: "",
        region: "",
        country: "",
        country_code: "",
        lat: null,
        lon: null,
      },
      owner: "My ISP",
      domain: "isp.example",
    });

    const result = await detectHosting("owner.example");
    expect(result.hostingProvider.name).toBe("My ISP");
    expect(result.hostingProvider.domain).toBe("isp.example");
  });

  it("falls back to root domains for email and DNS when unknown", async () => {
    const { resolveAll } = await import("@/server/services/dns");
    const { probeHeaders } = await import("@/server/services/headers");
    const { detectHosting } = await import("@/server/services/hosting");
    (resolveAll as unknown as Mock).mockResolvedValue({
      records: [
        { type: "A", name: "example.com", value: "1.1.1.1", ttl: 60 },
        {
          type: "MX",
          name: "example.com",
          value: "mx.mailprovider.example.com",
          ttl: 300,
          priority: 10,
        },
        {
          type: "NS",
          name: "example.com",
          value: "ns1.dnsprovider.example.net",
          ttl: 600,
        },
      ],
      source: "mock",
    });
    (probeHeaders as unknown as Mock).mockResolvedValue({
      headers: [],
      status: 200,
      statusMessage: "OK",
    });

    const result = await detectHosting("fallbacks.example");
    expect(result.emailProvider.domain).toBe("example.com");
    expect(result.dnsProvider.domain).toBe("example.net");
  });

  it("creates provider rows for DNS and Email when missing and links them", async () => {
    const { resolveAll } = await import("@/server/services/dns");
    const { probeHeaders } = await import("@/server/services/headers");
    const { detectHosting } = await import("@/server/services/hosting");

    (resolveAll as unknown as Mock).mockResolvedValue({
      records: [
        { type: "A", name: "example.com", value: "1.2.3.4", ttl: 60 },
        {
          type: "MX",
          name: "example.com",
          value: "aspmx.l.google.com",
          ttl: 300,
          priority: 10,
        },
        {
          type: "NS",
          name: "example.com",
          value: "ns1.cloudflare.com",
          ttl: 600,
        },
      ],
      source: "mock",
    });
    (probeHeaders as unknown as Mock).mockResolvedValue({
      headers: [],
      status: 200,
      statusMessage: "OK",
    });

    // Create domain record first (simulates registered domain)
    const { db } = await import("@/lib/db/client");
    const { upsertDomain } = await import("@/lib/db/repos/domains");
    const { domains, hosting, providers } = await import("@/lib/db/schema");
    await upsertDomain({
      name: "provider-create.com",
      tld: "com",
      unicodeName: "provider-create.com",
    });

    await detectHosting("provider-create.com");

    const { eq } = await import("drizzle-orm");
    const d = await db
      .select({ id: domains.id })
      .from(domains)
      .where(eq(domains.name, "provider-create.com"))
      .limit(1);
    const row = (
      await db
        .select({
          emailProviderId: hosting.emailProviderId,
          dnsProviderId: hosting.dnsProviderId,
        })
        .from(hosting)
        .where(eq(hosting.domainId, d[0].id))
        .limit(1)
    )[0];
    expect(row.emailProviderId).toBeTruthy();
    expect(row.dnsProviderId).toBeTruthy();

    const email = (
      await db
        .select({ name: providers.name })
        .from(providers)
        .where(eq(providers.id, row.emailProviderId as string))
        .limit(1)
    )[0];
    const dns = (
      await db
        .select({ name: providers.name })
        .from(providers)
        .where(eq(providers.id, row.dnsProviderId as string))
        .limit(1)
    )[0];
    expect(email?.name).toMatch(/google/i);
    expect(dns?.name).toMatch(/cloudflare/i);
  });
});
