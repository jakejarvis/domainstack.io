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
import type { Provider } from "@/lib/providers/parser";
import type { DnsRecord, ProviderCategory } from "@/lib/types";

// Mock DNS workflow responses by domain
const DNS_MOCK_DATA: Record<string, DnsRecord[]> = {
  "web-hosting.example": [
    { type: "A", name: "web-hosting.example", value: "1.2.3.4", ttl: 3600 },
    {
      type: "MX",
      name: "web-hosting.example",
      value: "aspmx.l.google.com",
      ttl: 3600,
      priority: 10,
    },
    {
      type: "NS",
      name: "web-hosting.example",
      value: "ns1.cloudflare.com",
      ttl: 3600,
    },
  ],
  "no-a.example": [
    {
      type: "MX",
      name: "no-a.example",
      value: "mail.example.com",
      ttl: 3600,
      priority: 10,
    },
    { type: "NS", name: "no-a.example", value: "ns1.example.net", ttl: 3600 },
  ],
  "email-only.example": [
    {
      type: "MX",
      name: "email-only.example",
      value: "mail.example.com",
      ttl: 3600,
      priority: 10,
    },
    {
      type: "NS",
      name: "email-only.example",
      value: "ns1.example.net",
      ttl: 3600,
    },
  ],
  "owner.example": [
    { type: "A", name: "owner.example", value: "9.9.9.9", ttl: 3600 },
    {
      type: "NS",
      name: "owner.example",
      value: "ns1.example.net",
      ttl: 3600,
    },
  ],
  "provider-create.example": [
    { type: "A", name: "provider-create.example", value: "1.2.3.4", ttl: 3600 },
    {
      type: "MX",
      name: "provider-create.example",
      value: "aspmx.l.google.com",
      ttl: 3600,
      priority: 10,
    },
    {
      type: "NS",
      name: "provider-create.example",
      value: "ns1.cloudflare.com",
      ttl: 3600,
    },
  ],
};

// Mock workflow API
vi.mock("workflow/api", () => ({
  start: vi.fn((workflow: { name: string }, args: unknown[]) => {
    const { domain } = (args as [{ domain: string }])[0];

    // Handle DNS workflow
    if (workflow.name === "dnsWorkflow") {
      const records = DNS_MOCK_DATA[domain] ?? [];
      return Promise.resolve({
        runId: `mock-dns-run-${domain}`,
        returnValue: Promise.resolve({
          data: { records, resolver: "mock" },
          cached: false,
          success: true,
        }),
      });
    }

    // Handle headers workflow
    if (workflow.name === "headersWorkflow") {
      return Promise.resolve({
        runId: `mock-headers-run-${domain}`,
        returnValue: Promise.resolve({
          data: {
            headers: [{ name: "server", value: "nginx" }],
            status: 200,
            statusMessage: "OK",
          },
          cached: false,
          success: true,
        }),
      });
    }

    // Default fallback
    return Promise.resolve({
      runId: `mock-run-${domain}`,
      returnValue: Promise.resolve({
        data: {},
        cached: false,
        success: true,
      }),
    });
  }),
}));

// Mock provider catalog to return test providers
const TEST_PROVIDERS: Record<ProviderCategory, Provider[]> = {
  hosting: [
    {
      name: "Vercel",
      domain: "vercel.com",
      category: "hosting",
      rule: {
        any: [
          { kind: "headerEquals", name: "server", value: "vercel" },
          { kind: "headerPresent", name: "x-vercel-id" },
        ],
      },
    },
  ],
  email: [
    {
      name: "Google Workspace",
      domain: "google.com",
      category: "email",
      rule: {
        any: [
          { kind: "mxSuffix", suffix: "smtp.google.com" },
          { kind: "mxSuffix", suffix: "aspmx.l.google.com" },
          { kind: "mxSuffix", suffix: "googlemail.com" },
        ],
      },
    },
  ],
  dns: [
    {
      name: "Cloudflare",
      domain: "cloudflare.com",
      category: "dns",
      rule: { kind: "nsSuffix", suffix: "cloudflare.com" },
    },
  ],
  ca: [],
  registrar: [],
};

vi.mock("@/lib/providers/catalog", () => ({
  getProviders: vi.fn((category: ProviderCategory) =>
    Promise.resolve(TEST_PROVIDERS[category] ?? []),
  ),
  getAllProviders: vi.fn(() => Promise.resolve(TEST_PROVIDERS)),
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

describe("getHosting", () => {
  it("returns known providers when signals match (Vercel/Google/Cloudflare)", async () => {
    const { getHosting } = await import("@/server/services/hosting");

    const result = await getHosting("web-hosting.example");

    expect(result.dnsProvider.name).toBe("Cloudflare");
    expect(result.dnsProvider.domain).toBe("cloudflare.com");
  });

  it("sets hosting to none when no A record is present", async () => {
    const { getHosting } = await import("@/server/services/hosting");
    // "no-a.example" has MX and NS but no A in handlers.ts
    const result = await getHosting("no-a.example");
    expect(result.hostingProvider.name).toBeNull();
    expect(result.hostingProvider.domain).toBeNull();
  });

  it("skips headers probe when domain has no A or AAAA records", async () => {
    const { getHosting } = await import("@/server/services/hosting");
    const workflowApi = await import("workflow/api");
    const startSpy = vi.mocked(workflowApi.start);

    // Reset call count
    startSpy.mockClear();

    // "email-only.example" has MX and NS but no A in handlers.ts
    await getHosting("email-only.example");

    // Should only call dns workflow, not headers workflow
    const calls = startSpy.mock.calls;
    const workflowNames = calls.map((c) => {
      const workflow = c[0] as { name: string };
      return workflow.name;
    });
    expect(workflowNames).not.toContain("headersWorkflow");
  });

  it("calls headers probe when domain has A or AAAA records", async () => {
    const { getHosting } = await import("@/server/services/hosting");
    const workflowApi = await import("workflow/api");
    const startSpy = vi.mocked(workflowApi.start);

    // Reset call count
    startSpy.mockClear();

    // "web-hosting.example" has A record
    await getHosting("web-hosting.example");

    // Should call both dns and headers workflows
    const calls = startSpy.mock.calls;
    const workflowNames = calls.map((c) => {
      const workflow = c[0] as { name: string };
      return workflow.name;
    });
    expect(workflowNames).toContain("headersWorkflow");
  });

  it("falls back to IP owner when hosting is unknown and IP owner exists", async () => {
    const { getHosting } = await import("@/server/services/hosting");
    // "owner.example" resolves to 9.9.9.9 which mocks to "My ISP"
    const result = await getHosting("owner.example");
    expect(result.hostingProvider.name).toBe("My ISP");
    expect(result.hostingProvider.domain).toBe("isp.example");
  });

  it("creates provider rows for DNS and Email when missing and links them", async () => {
    const { getHosting } = await import("@/server/services/hosting");

    // "provider-create.example" is set up in handlers.ts
    // Create domain record first
    const { upsertDomain } = await import("@/lib/db/repos/domains");
    await upsertDomain({
      name: "provider-create.example",
      tld: "example",
      unicodeName: "provider-create.example",
    });

    await getHosting("provider-create.example");

    const { db } = await import("@/lib/db/client");
    const { domains, hosting, providers } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    const d = await db
      .select({ id: domains.id })
      .from(domains)
      .where(eq(domains.name, "provider-create.example"))
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
